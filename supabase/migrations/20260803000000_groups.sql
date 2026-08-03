-- ============================================================
-- Groups — a named crew you create and invite people into.
--
-- First half of the groups subsystem. This adds the entity and its
-- membership only; scoping posts to a group audience is a separate
-- migration, deliberately, because that is where a mistake leaks a
-- private post and it deserves its own review.
--
-- Membership shape: (group_id, user_id) is the primary key, so a person
-- has exactly one row per group and re-inviting someone updates that row
-- rather than accumulating duplicates. `status` carries the lifecycle —
-- invited → active | declined, or → removed — instead of deleting rows,
-- so "I already declined this" is distinguishable from "never invited",
-- and a re-invite is a status change with an audit trail in joined_at.
--
-- Every write goes through a security-definer RPC below; the tables
-- themselves grant no INSERT/UPDATE/DELETE to authenticated. That keeps
-- the invariants (only members invite, only the owner removes, an owner
-- leaving hands the group over) in one place rather than spread across
-- RLS policies that are OR-ed together and easy to widen by accident.
-- ============================================================

create table if not exists public.groups (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 60),
    created_by uuid not null references public.users,
    created_at timestamptz not null default now(),
    -- Soft delete, matching posts. Set when the last active member leaves.
    deleted_at timestamptz
);

create table if not exists public.group_members (
    group_id uuid not null references public.groups on delete cascade,
    user_id uuid not null references public.users,
    role text not null default 'member' check (role in ('owner', 'member')),
    status text not null default 'invited' check (status in ('invited', 'active', 'declined', 'removed')),
    invited_by uuid references public.users,
    created_at timestamptz not null default now(),
    joined_at timestamptz,
    primary key (group_id, user_id)
);

-- "Which groups am I in" is the hot path — every feed read will eventually
-- ask it once the audience migration lands. posts has no indexes at all, so
-- this is also the first index anyone added to this schema on purpose.
create index if not exists group_members_user_status_idx
    on public.group_members (user_id, status);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- ------------------------------------------------------------
-- Membership helpers.
--
-- security definer so they bypass RLS: a policy on group_members that
-- checks group_members directly recurses, which is the same trap
-- 20260729000000_restrict_users_select.sql hit on users and solved the
-- same way. search_path is pinned so the function body cannot be
-- redirected by a caller's search_path.
-- ------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.group_members
        where group_id = p_group_id and user_id = p_user_id and status = 'active'
    );
$$;

/** Active OR still-pending invite — enough to see the group's name and roster. */
create or replace function public.has_group_access(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.group_members
        where group_id = p_group_id and user_id = p_user_id and status in ('active', 'invited')
    );
$$;

-- ------------------------------------------------------------
-- RLS. Reads only — writes go through the RPCs.
-- ------------------------------------------------------------
drop policy if exists "Members read their groups" on public.groups;
create policy "Members read their groups" on public.groups
    for select using (deleted_at is null and public.has_group_access(id));

drop policy if exists "Admins read all groups" on public.groups;
create policy "Admins read all groups" on public.groups
    for select using (public.is_admin_user());

drop policy if exists "Members read the roster" on public.group_members;
create policy "Members read the roster" on public.group_members
    for select using (user_id = auth.uid() or public.has_group_access(group_id));

drop policy if exists "Admins read all memberships" on public.group_members;
create policy "Admins read all memberships" on public.group_members
    for select using (public.is_admin_user());

-- ------------------------------------------------------------
-- Writes.
-- ------------------------------------------------------------

/** Create a group; the caller becomes its active owner. */
create or replace function public.create_group(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_id uuid;
begin
    if v_uid is null then
        return jsonb_build_object('success', false, 'error', 'Not authenticated');
    end if;
    if coalesce(btrim(p_name), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Give the group a name');
    end if;

    insert into public.groups (name, created_by)
    values (btrim(p_name), v_uid)
    returning id into v_id;

    insert into public.group_members (group_id, user_id, role, status, joined_at)
    values (v_id, v_uid, 'owner', 'active', now());

    return jsonb_build_object('success', true, 'group_id', v_id);
end;
$$;

/** Invite someone. Any active member may invite; re-inviting a declined or removed person re-opens it. */
create or replace function public.invite_to_group(p_group_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if not public.is_group_member(p_group_id, v_uid) then
        return jsonb_build_object('success', false, 'error', 'Only members can invite');
    end if;
    if not exists (select 1 from public.users where id = p_user_id and deleted_at is null and is_suspended = false) then
        return jsonb_build_object('success', false, 'error', 'That player is unavailable');
    end if;
    -- Already in? Nothing to do — don't demote an active member to 'invited'.
    if public.is_group_member(p_group_id, p_user_id) then
        return jsonb_build_object('success', true, 'already_member', true);
    end if;

    insert into public.group_members (group_id, user_id, status, invited_by)
    values (p_group_id, p_user_id, 'invited', v_uid)
    on conflict (group_id, user_id) do update
        set status = 'invited', invited_by = v_uid, created_at = now();

    return jsonb_build_object('success', true);
end;
$$;

/** Accept or decline an invite addressed to the caller. */
create or replace function public.respond_to_group_invite(p_group_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_updated int;
begin
    update public.group_members
    set status = case when p_accept then 'active' else 'declined' end,
        joined_at = case when p_accept then now() else joined_at end
    where group_id = p_group_id and user_id = v_uid and status = 'invited';

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
        return jsonb_build_object('success', false, 'error', 'That invite is no longer open');
    end if;
    return jsonb_build_object('success', true, 'joined', p_accept);
end;
$$;

/**
 * Leave a group. An owner leaving hands ownership to the longest-standing
 * remaining member; if nobody is left the group is soft-deleted, so an
 * abandoned group stops appearing anywhere rather than lingering ownerless.
 */
create or replace function public.leave_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_was_owner boolean;
    v_heir uuid;
begin
    select role = 'owner' into v_was_owner
    from public.group_members
    where group_id = p_group_id and user_id = v_uid and status = 'active';

    if v_was_owner is null then
        return jsonb_build_object('success', false, 'error', 'You are not in that group');
    end if;

    update public.group_members
    set status = 'removed', role = 'member'
    where group_id = p_group_id and user_id = v_uid;

    if v_was_owner then
        select user_id into v_heir
        from public.group_members
        where group_id = p_group_id and status = 'active'
        order by joined_at nulls last, created_at
        limit 1;

        if v_heir is null then
            update public.groups set deleted_at = now() where id = p_group_id;
        else
            update public.group_members set role = 'owner'
            where group_id = p_group_id and user_id = v_heir;
        end if;
    end if;

    return jsonb_build_object('success', true, 'group_deleted', v_was_owner and v_heir is null);
end;
$$;

/** Owner-only removal of someone else. */
create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if not exists (
        select 1 from public.group_members
        where group_id = p_group_id and user_id = v_uid and role = 'owner' and status = 'active'
    ) then
        return jsonb_build_object('success', false, 'error', 'Only the group owner can remove players');
    end if;
    if p_user_id = v_uid then
        return jsonb_build_object('success', false, 'error', 'Use Leave group instead');
    end if;

    update public.group_members set status = 'removed'
    where group_id = p_group_id and user_id = p_user_id;

    return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------
-- Reads.
-- ------------------------------------------------------------

/** Groups the caller is in or has been invited to, newest activity first. */
create or replace function public.get_my_groups()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(g order by g.my_status, g.name), '[]'::jsonb)
    from (
        select
            gr.id,
            gr.name,
            gm.role as my_role,
            gm.status as my_status,
            gm.created_at as invited_at,
            (select count(*)::integer from public.group_members m
             where m.group_id = gr.id and m.status = 'active') as member_count,
            (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', u.id, 'first_name', u.first_name, 'photo_url', u.photo_url)
                     order by m2.joined_at nulls last), '[]'::jsonb)
             from public.group_members m2
             join public.users u on u.id = m2.user_id
             where m2.group_id = gr.id and m2.status = 'active'
               and u.deleted_at is null
             limit 5) as preview
        from public.groups gr
        join public.group_members gm on gm.group_id = gr.id and gm.user_id = auth.uid()
        where gr.deleted_at is null
          and gm.status in ('active', 'invited')
    ) g;
$$;

/** One group with its full active roster. Members and invitees only. */
create or replace function public.get_group(p_group_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select case when not public.has_group_access(p_group_id) then null else (
        select jsonb_build_object(
            'id', gr.id,
            'name', gr.name,
            'created_by', gr.created_by,
            'my_role', (select role from public.group_members
                        where group_id = gr.id and user_id = auth.uid()),
            'my_status', (select status from public.group_members
                          where group_id = gr.id and user_id = auth.uid()),
            'members', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'photo_url', u.photo_url,
                    'skill_level', u.skill_level,
                    'role', m.role,
                    'status', m.status
                ) order by m.role, m.joined_at nulls last)
                from public.group_members m
                join public.users u on u.id = m.user_id
                where m.group_id = gr.id
                  and m.status in ('active', 'invited')
                  and u.deleted_at is null
            ), '[]'::jsonb)
        )
        from public.groups gr
        where gr.id = p_group_id and gr.deleted_at is null
    ) end;
$$;

-- ------------------------------------------------------------
-- Grants. Supabase default-grants EXECUTE to anon directly, so revoking
-- from public alone leaves anon able to call these — revoke from both,
-- then grant only authenticated. None of these are safe for anon: they
-- all key off auth.uid() and would silently operate as "no user".
-- ------------------------------------------------------------
do $$
declare
    fn text;
begin
    foreach fn in array array[
        'public.is_group_member(uuid, uuid)',
        'public.has_group_access(uuid, uuid)',
        'public.create_group(text)',
        'public.invite_to_group(uuid, uuid)',
        'public.respond_to_group_invite(uuid, boolean)',
        'public.leave_group(uuid)',
        'public.remove_group_member(uuid, uuid)',
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
