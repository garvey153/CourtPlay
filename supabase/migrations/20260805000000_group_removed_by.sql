-- ============================================================
-- Record WHO removed a membership, so leaving your own group does not
-- announce itself back to you.
--
-- removed_at alone cannot distinguish "the creator removed me" from "I left".
-- The feed banner keyed off it either way, so a member who left a group was
-- then told, on their own feed, that they were no longer in it — a notice about
-- an action they had just deliberately taken.
--
-- removed_by is the actor, not the subject: equal to user_id for a self-removal
-- (leave_group), and the creator's id when they remove someone (update_group)
-- or close the group (close_group).
-- ============================================================

alter table public.group_members add column if not exists removed_by uuid references public.users;

-- Existing rows predate this and cannot be attributed. Leaving them null is
-- deliberate: null reads as "unknown actor", and the feed treats unknown as
-- not-self, which is the safe direction — it may show a banner that should not
-- have appeared, rather than swallow one that should.

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
    set removed_at = now(), removed_by = v_uid
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

    -- The creator's own exit is still a self-removal: they chose it.
    update public.group_members
    set removed_at = now(), removed_by = v_uid
    where group_id = p_group_id and user_id = v_uid and removed_at is null;

    select count(*) into v_left
    from public.group_members where group_id = p_group_id and removed_at is null;

    if v_left = 0 then
        update public.groups set deleted_at = now() where id = p_group_id;
    end if;

    return jsonb_build_object('success', true, 'group_deleted', v_left = 0);
end;
$$;

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

    -- Removed BY the creator, which is what makes the banner legitimate.
    update public.group_members
    set removed_at = now(), removed_by = v_uid
    where group_id = p_group_id and removed_at is null and user_id <> all(v_members);

    insert into public.group_members (group_id, user_id)
    select p_group_id, unnest(v_members)
    on conflict (group_id, user_id) do update
        set removed_at = null, removed_by = null, created_at = now();

    return jsonb_build_object('success', true);
end;
$$;

/**
 * Adds removed_by_me so the feed can tell a removal apart from a departure.
 * Everything else is unchanged from 20260804000004.
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
            -- null removed_by (pre-migration rows) reads as false, i.e. not self,
            -- which is the safe direction for a notice.
            (gm.removed_by is not null and gm.removed_by = auth.uid()) as removed_by_me,
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
