-- ============================================================
-- Groups v2 — collections of players, owned by their creator.
--
-- Rebuilt after 20260804000000 dropped the first attempt. The model here:
-- the creator adds and removes people directly (no invite/accept step), any
-- member can remove themselves, and the group is deleted once it is empty.
-- There is no messaging.
--
-- MEMBERSHIP IS DEFINED IN EXACTLY TWO PLACES, and nowhere else inlines a
-- query against group_members to decide it:
--
--   is_group_member(group, user)  — the point check: is this person in it?
--   my_group_ids()                — the set: which groups is the caller in?
--
-- Both exist because enumeration cannot use the point check without calling it
-- once per row. Everything else — the RLS policies, get_group, get_my_groups,
-- find_duplicate_group, and the feed filter, private-post audiences and post
-- tagging still to come — goes through one of them.
--
-- That is deliberate. If an invite/accept step is added later it becomes the
-- same one-line `and status = 'active'` in both, and every consumer follows,
-- instead of a hunt across call sites where a single missed one would let a
-- pending invitee read private posts. They are kept adjacent for that reason.
-- ============================================================

create table if not exists public.groups (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 60),
    -- The "Westport Social League" line under the name in 588:6254. Optional.
    details text check (details is null or length(btrim(details)) <= 80),
    created_by uuid not null references public.users,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
);

create table if not exists public.group_members (
    group_id uuid not null references public.groups on delete cascade,
    user_id uuid not null references public.users,
    created_at timestamptz not null default now(),
    primary key (group_id, user_id)
);

-- "Which groups is this person in" — the hot path for every downstream feature.
create index if not exists group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- ------------------------------------------------------------
-- The membership check. security definer because a policy on group_members
-- that reads group_members recurses — the trap 20260729000000 documents on
-- users. search_path pinned so a caller cannot redirect the body.
-- ------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.group_members gm
        join public.groups g on g.id = gm.group_id
        where gm.group_id = p_group_id
          and gm.user_id = p_user_id
          and g.deleted_at is null
    );
$$;

/**
 * The set form of the same question: which groups is the caller in.
 *
 * Enumeration cannot use is_group_member() without calling it once per group in
 * the table, so it gets its own definition — but only one. Everything that needs
 * "my groups" goes through here rather than joining group_members itself.
 *
 * These two functions are the ONLY places membership is defined. If an
 * invite/accept step is added later, both grow the same `and status = 'active'`
 * and every consumer follows. They are kept adjacent so neither is missed.
 */
create or replace function public.my_group_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(array_agg(gm.group_id), '{}')
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = auth.uid()
      and g.deleted_at is null;
$$;

-- ------------------------------------------------------------
-- RLS — reads only. Writes go through the RPCs so the invariants (creator-only
-- membership changes, delete-when-empty) live in one place rather than across
-- OR-ed policies.
-- ------------------------------------------------------------
drop policy if exists "Members read their groups" on public.groups;
create policy "Members read their groups" on public.groups
    for select using (deleted_at is null and public.is_group_member(id));

drop policy if exists "Admins read all groups" on public.groups;
create policy "Admins read all groups" on public.groups
    for select using (public.is_admin_user());

drop policy if exists "Members read the roster" on public.group_members;
create policy "Members read the roster" on public.group_members
    for select using (public.is_group_member(group_id));

drop policy if exists "Admins read all memberships" on public.group_members;
create policy "Admins read all memberships" on public.group_members
    for select using (public.is_admin_user());

-- ------------------------------------------------------------
-- Shared internals.
-- ------------------------------------------------------------

/**
 * The member set of a group, sorted — the identity used for duplicate detection.
 */
create or replace function public.group_member_set(p_group_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(array_agg(user_id order by user_id), '{}')
    from public.group_members where group_id = p_group_id;
$$;

/**
 * A group of the caller's whose membership is exactly p_members, ignoring
 * p_exclude (the group being edited).
 *
 * Scoped to groups the caller belongs to on purpose. A global check would
 * answer "does a group with exactly these people exist?" for anyone, which
 * leaks the composition of groups the caller cannot otherwise see.
 */
create or replace function public.find_duplicate_group(p_members uuid[], p_exclude uuid default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select g.id
    from public.groups g
    where g.id = any(public.my_group_ids())
      and (p_exclude is null or g.id <> p_exclude)
      and public.group_member_set(g.id) = (select array_agg(x order by x) from unnest(p_members) x)
    limit 1;
$$;

-- ------------------------------------------------------------
-- Writes.
-- ------------------------------------------------------------

/**
 * Create a group. The caller is always a member, whether or not they appear in
 * p_member_ids — you cannot make a group you are not in.
 */
create or replace function public.create_group(p_name text, p_details text, p_member_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_members uuid[];
    v_dupe uuid;
    v_id uuid;
begin
    if v_uid is null then
        return jsonb_build_object('success', false, 'error', 'Not authenticated');
    end if;
    if coalesce(btrim(p_name), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Give the group a name');
    end if;

    -- Dedupe, drop unavailable accounts, and force the creator in.
    select array_agg(distinct u.id) into v_members
    from public.users u
    where u.id = any(coalesce(p_member_ids, '{}') || v_uid)
      and u.deleted_at is null
      and u.is_suspended = false;

    v_dupe := public.find_duplicate_group(v_members);
    if v_dupe is not null then
        return jsonb_build_object(
            'success', false,
            'error', 'You already have a group with exactly these players',
            'duplicate_group_id', v_dupe
        );
    end if;

    insert into public.groups (name, details, created_by)
    values (btrim(p_name), nullif(btrim(coalesce(p_details, '')), ''), v_uid)
    returning id into v_id;

    insert into public.group_members (group_id, user_id)
    select v_id, unnest(v_members);

    return jsonb_build_object('success', true, 'group_id', v_id);
end;
$$;

/** Rename a group and set its membership. Creator only. */
create or replace function public.update_group(p_group_id uuid, p_name text, p_details text, p_member_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_members uuid[];
    v_dupe uuid;
begin
    if not exists (
        select 1 from public.groups
        where id = p_group_id and created_by = v_uid and deleted_at is null
    ) then
        return jsonb_build_object('success', false, 'error', 'Only the group creator can edit it');
    end if;
    if coalesce(btrim(p_name), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Give the group a name');
    end if;

    select array_agg(distinct u.id) into v_members
    from public.users u
    where u.id = any(coalesce(p_member_ids, '{}') || v_uid)
      and u.deleted_at is null
      and u.is_suspended = false;

    v_dupe := public.find_duplicate_group(v_members, p_group_id);
    if v_dupe is not null then
        return jsonb_build_object(
            'success', false,
            'error', 'You already have a group with exactly these players',
            'duplicate_group_id', v_dupe
        );
    end if;

    update public.groups
    set name = btrim(p_name),
        details = nullif(btrim(coalesce(p_details, '')), '')
    where id = p_group_id;

    delete from public.group_members
    where group_id = p_group_id and user_id <> all(v_members);

    insert into public.group_members (group_id, user_id)
    select p_group_id, unnest(v_members)
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('success', true);
end;
$$;

/**
 * Remove yourself. Anyone may do this, including the creator.
 *
 * The group is soft-deleted once the last member goes. A creator who leaves
 * while others remain does NOT hand over — nobody can then add or remove, and
 * the remaining members can only leave. That is the literal reading of the
 * spec; worth revisiting if a group outliving its creator turns out to matter.
 */
create or replace function public.leave_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_left int;
begin
    delete from public.group_members
    where group_id = p_group_id and user_id = v_uid;

    if not found then
        return jsonb_build_object('success', false, 'error', 'You are not in that group');
    end if;

    select count(*) into v_left from public.group_members where group_id = p_group_id;
    if v_left = 0 then
        update public.groups set deleted_at = now() where id = p_group_id;
    end if;

    return jsonb_build_object('success', true, 'group_deleted', v_left = 0);
end;
$$;

/** Delete the whole group. Creator only. */
create or replace function public.delete_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    update public.groups
    set deleted_at = now()
    where id = p_group_id and created_by = v_uid and deleted_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Only the group creator can delete it');
    end if;

    delete from public.group_members where group_id = p_group_id;
    return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------
-- Reads.
-- ------------------------------------------------------------

/** The caller's groups, with the member preview the Profile card needs. */
create or replace function public.get_my_groups()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(g order by g.name), '[]'::jsonb)
    from (
        select
            gr.id,
            gr.name,
            gr.details,
            (gr.created_by = auth.uid()) as is_creator,
            (select count(*)::integer from public.group_members m where m.group_id = gr.id) as member_count,
            coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'photo_url', u.photo_url
                ) order by u.first_name)
                from public.group_members m2
                join public.users u on u.id = m2.user_id
                where m2.group_id = gr.id and u.deleted_at is null
            ), '[]'::jsonb) as members
        from public.groups gr
        where gr.id = any(public.my_group_ids())
    ) g;
$$;

/** One group with its roster. Members only — null otherwise, which reads as gone. */
create or replace function public.get_group(p_group_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select case when not public.is_group_member(p_group_id) then null else (
        select jsonb_build_object(
            'id', gr.id,
            'name', gr.name,
            'details', gr.details,
            'created_by', gr.created_by,
            'is_creator', (gr.created_by = auth.uid()),
            'members', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'photo_url', u.photo_url,
                    'skill_level', u.skill_level,
                    'is_creator', (u.id = gr.created_by)
                ) order by (u.id = gr.created_by) desc, u.first_name)
                from public.group_members m
                join public.users u on u.id = m.user_id
                where m.group_id = gr.id and u.deleted_at is null
            ), '[]'::jsonb)
        )
        from public.groups gr
        where gr.id = p_group_id and gr.deleted_at is null
    ) end;
$$;

-- ------------------------------------------------------------
-- Grants. Supabase default-grants EXECUTE to anon directly, so revoking from
-- public alone leaves anon able to call these — revoke from both. Every one of
-- them keys off auth.uid() and would silently act as "no user" for anon.
-- ------------------------------------------------------------
do $$
declare
    fn text;
begin
    foreach fn in array array[
        'public.is_group_member(uuid, uuid)',
        'public.my_group_ids()',
        'public.group_member_set(uuid)',
        'public.find_duplicate_group(uuid[], uuid)',
        'public.create_group(text, text, uuid[])',
        'public.update_group(uuid, text, text, uuid[])',
        'public.leave_group(uuid)',
        'public.delete_group(uuid)',
        'public.get_my_groups()',
        'public.get_group(uuid)'
    ] loop
        execute format('revoke all on function %s from public, anon', fn);
        execute format('grant execute on function %s to authenticated', fn);
    end loop;
end $$;

revoke all on public.groups from anon;
revoke all on public.group_members from anon;
grant select on public.groups to authenticated;
grant select on public.group_members to authenticated;
