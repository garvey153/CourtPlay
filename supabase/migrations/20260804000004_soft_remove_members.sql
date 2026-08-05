-- ============================================================
-- Keep the membership row when someone is removed.
--
-- Removing a member used to DELETE their row, which left nothing to derive a
-- "you were removed" feed banner from — so removal was push/email only. The row
-- itself is the event record; a separate events table was never needed.
--
-- What this buys, beyond the banner:
--   * "was removed" is distinguishable from "never a member", so a re-add is an
--     un-removal rather than a fresh insert
--   * the (group_id, user_id) primary key still holds, so one person can never
--     accumulate rows for the same group however often they are added and removed
--
-- THE COST, STATED PLAINLY: membership is now three predicates, not two. The
-- point check and the audience set were already behind helpers, but the member
-- COUNTS are a third membership-flavoured question and were not. All three now
-- filter on removed_at, and any new one must too.
--
-- Deletion of the group itself still hard-deletes and cascades these rows away,
-- so a group that disappears takes its unseen removal banners with it. Accepted:
-- the push/email has already gone out, and a banner pointing at a group that no
-- longer exists would be stranger than losing it.
-- ============================================================

alter table public.group_members add column if not exists removed_at timestamptz;

-- Membership lookups are now "rows that are still live".
create index if not exists group_members_user_live_idx
    on public.group_members (user_id) where removed_at is null;

-- ------------------------------------------------------------
-- The three membership predicates.
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
          and gm.removed_at is null
          and g.deleted_at is null
    );
$$;

create or replace function public.my_active_group_ids()
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
      and gm.removed_at is null
      and g.deleted_at is null
      and g.closed_at is null;
$$;

create or replace function public.group_member_set(p_group_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(array_agg(user_id order by user_id), '{}')
    from public.group_members
    where group_id = p_group_id and removed_at is null;
$$;

-- ------------------------------------------------------------
-- Writes — removals become stamps, re-adds become un-removals.
-- ------------------------------------------------------------
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
        where id = p_group_id and created_by = v_uid and deleted_at is null and closed_at is null
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

    -- Stamp, don't delete: the row is what the removed player's banner is built from.
    update public.group_members
    set removed_at = now()
    where group_id = p_group_id and removed_at is null and user_id <> all(v_members);

    insert into public.group_members (group_id, user_id)
    select p_group_id, unnest(v_members)
    on conflict (group_id, user_id) do update
        set removed_at = null, created_at = now();

    return jsonb_build_object('success', true);
end;
$$;

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
    if exists (
        select 1 from public.groups
        where id = p_group_id and created_by = v_uid and closed_at is null and deleted_at is null
    ) then
        return jsonb_build_object('success', false, 'error', 'Close the group instead');
    end if;

    update public.group_members
    set removed_at = now()
    where group_id = p_group_id and user_id = v_uid and removed_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'You are not in that group');
    end if;

    select count(*) into v_left
    from public.group_members where group_id = p_group_id and removed_at is null;

    if v_left = 0 then
        update public.groups set deleted_at = now() where id = p_group_id;
    end if;

    return jsonb_build_object('success', true, 'group_deleted', v_left = 0);
end;
$$;

create or replace function public.close_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_left int;
begin
    update public.groups
    set closed_at = now()
    where id = p_group_id and created_by = v_uid and deleted_at is null and closed_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Only the group creator can close it');
    end if;

    update public.group_members
    set removed_at = now()
    where group_id = p_group_id and user_id = v_uid and removed_at is null;

    select count(*) into v_left
    from public.group_members where group_id = p_group_id and removed_at is null;

    if v_left = 0 then
        update public.groups set deleted_at = now() where id = p_group_id;
    end if;

    return jsonb_build_object('success', true, 'group_deleted', v_left = 0);
end;
$$;

-- ------------------------------------------------------------
-- Reads.
-- ------------------------------------------------------------

/**
 * The caller's groups, plus any they were removed from in the last 30 days.
 *
 * Removed rows are returned ONLY so the feed can show a "you were removed"
 * banner, and are flagged with my_removed_at. Anything listing groups the caller
 * is actually in — the Profile section — must filter them out.
 *
 * Bounded at 30 days so the payload cannot grow without limit; the feed applies
 * a shorter window of its own.
 */
create or replace function public.get_my_groups()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(g order by g.is_closed, g.name), '[]'::jsonb)
    from (
        select
            gr.id,
            gr.name,
            gr.details,
            (gr.created_by = auth.uid()) as is_creator,
            (gr.closed_at is not null) as is_closed,
            gr.closed_at,
            gm.created_at as joined_at,
            gm.removed_at as my_removed_at,
            (select count(*)::integer from public.group_members m
             where m.group_id = gr.id and m.removed_at is null) as member_count,
            coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'photo_url', u.photo_url
                ) order by u.first_name)
                from public.group_members m2
                join public.users u on u.id = m2.user_id
                where m2.group_id = gr.id and m2.removed_at is null and u.deleted_at is null
            ), '[]'::jsonb) as members
        from public.groups gr
        join public.group_members gm on gm.group_id = gr.id and gm.user_id = auth.uid()
        where gr.deleted_at is null
          and (gm.removed_at is null or gm.removed_at > now() - interval '30 days')
    ) g;
$$;

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
            'is_closed', (gr.closed_at is not null),
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
                where m.group_id = gr.id and m.removed_at is null and u.deleted_at is null
            ), '[]'::jsonb)
        )
        from public.groups gr
        where gr.id = p_group_id and gr.deleted_at is null
    ) end;
$$;
