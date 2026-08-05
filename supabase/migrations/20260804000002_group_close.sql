-- ============================================================
-- Group lifecycle: closing, and the difference between "in a group" and
-- "can post to a group".
--
-- The creator cannot leave a group — they close it. Closing is their exit:
-- it stamps closed_at, drops their own membership, and the group disappears
-- from their profile. Everyone else keeps seeing it, rendered void, until each
-- of them removes it. The row is deleted only when the last membership goes.
--
-- Consequence worth stating: an ACTIVE group can never reach zero members,
-- because the only person who cannot leave is the creator. Deletion is
-- therefore reachable exclusively through close → everyone removes.
--
-- THIS SPLITS THE MEMBERSHIP QUESTION IN TWO, and the distinction is the whole
-- point of this migration:
--
--   is_group_member(group, user)  — do they have a row? Governs READ access, so
--                                   a member can still open a closed group to
--                                   remove it.
--   my_active_group_ids()         — which groups can act as an AUDIENCE. Closed
--                                   groups are excluded: they are a tombstone,
--                                   not somewhere you can still post.
--
-- my_group_ids() is replaced by the second of those. It was ambiguous the
-- moment closing existed, and the ambiguity is exactly the kind that leaks a
-- private post to a group that is supposed to be finished.
-- ============================================================

alter table public.groups add column if not exists closed_at timestamptz;

-- ------------------------------------------------------------
-- The audience set. Active groups only.
-- ------------------------------------------------------------
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
      and g.deleted_at is null
      and g.closed_at is null;
$$;

-- find_duplicate_group must move off my_group_ids() before it can be dropped.
-- Closed groups are deliberately not compared: once a group is finished, the
-- same people should be able to start a new one.
create or replace function public.find_duplicate_group(p_members uuid[], p_exclude uuid default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select g.id
    from public.groups g
    where g.id = any(public.my_active_group_ids())
      and (p_exclude is null or g.id <> p_exclude)
      and public.group_member_set(g.id) = (select array_agg(x order by x) from unnest(p_members) x)
    limit 1;
$$;

-- ------------------------------------------------------------
-- Writes.
-- ------------------------------------------------------------

/**
 * Close a group. Creator only, and the creator's only way out.
 *
 * Drops the creator's own membership so it leaves their profile, and deletes
 * the group outright if nobody else was in it — a solo group has no one left to
 * show a tombstone to.
 */
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
    where id = p_group_id
      and created_by = v_uid
      and deleted_at is null
      and closed_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Only the group creator can close it');
    end if;

    delete from public.group_members where group_id = p_group_id and user_id = v_uid;

    select count(*) into v_left from public.group_members where group_id = p_group_id;
    if v_left = 0 then
        update public.groups set deleted_at = now() where id = p_group_id;
    end if;

    return jsonb_build_object('success', true, 'group_deleted', v_left = 0);
end;
$$;

/**
 * Remove yourself from a group — "Leave" while it is active, "Remove" once it
 * is closed. The same operation either way; only the copy differs.
 *
 * The creator is refused while the group is active: closing is their exit, and
 * letting them leave would strand the rest with a group nobody can administer.
 * Once closed they hold no membership anyway, so the check never fires then.
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
    if exists (
        select 1 from public.groups
        where id = p_group_id and created_by = v_uid and closed_at is null and deleted_at is null
    ) then
        return jsonb_build_object('success', false, 'error', 'Close the group instead');
    end if;

    delete from public.group_members where group_id = p_group_id and user_id = v_uid;
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

/** A closed group is finished — its membership can no longer be edited. */
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

    delete from public.group_members
    where group_id = p_group_id and user_id <> all(v_members);

    insert into public.group_members (group_id, user_id)
    select p_group_id, unnest(v_members)
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------
-- Reads — both now report closed state so the UI can render it void.
-- ------------------------------------------------------------
create or replace function public.get_my_groups()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    -- Not my_active_group_ids(): a closed group must stay on the profile,
    -- rendered void, until its remaining members clear it.
    select coalesce(jsonb_agg(g order by g.is_closed, g.name), '[]'::jsonb)
    from (
        select
            gr.id,
            gr.name,
            gr.details,
            (gr.created_by = auth.uid()) as is_creator,
            (gr.closed_at is not null) as is_closed,
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
        join public.group_members gm on gm.group_id = gr.id and gm.user_id = auth.uid()
        where gr.deleted_at is null
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
                where m.group_id = gr.id and u.deleted_at is null
            ), '[]'::jsonb)
        )
        from public.groups gr
        where gr.id = p_group_id and gr.deleted_at is null
    ) end;
$$;

-- Superseded by my_active_group_ids(). Dropped last: find_duplicate_group and
-- get_my_groups both had to stop calling it first.
drop function if exists public.my_group_ids();

do $$
declare
    fn text;
begin
    foreach fn in array array[
        'public.my_active_group_ids()',
        'public.close_group(uuid)'
    ] loop
        execute format('revoke all on function %s from public, anon', fn);
        execute format('grant execute on function %s to authenticated', fn);
    end loop;
end $$;
