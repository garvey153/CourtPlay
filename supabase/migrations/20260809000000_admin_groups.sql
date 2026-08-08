-- ============================================================
-- Admin Groups tab.
--
-- Groups gate who can see a private post and who is told about a tagged one,
-- and until now nobody could moderate them: get_group returns null unless
-- is_group_member() passes and get_my_groups is caller-scoped, so a group an
-- admin is not in was reachable only through SQL.
--
-- RLS has granted admins SELECT on both tables since 20260804000001; these
-- functions are what surfaces that, plus the four writes the tab needs.
--
-- Every one is security definer and therefore bypasses RLS, so the
-- is_admin_user() guard IS the access control. There is no second line.
-- ============================================================

-- ------------------------------------------------------------
-- Close the grant/RLS gap first.
--
-- 20260804000001 revoked from anon and granted SELECT to authenticated, but
-- never revoked authenticated's Supabase default of ALL — so the write
-- privileges are still there and only RLS (which has SELECT policies and
-- nothing else) stops them being used. That is one stray permissive policy away
-- from letting any signed-in user rewrite a roster. Make the grant match the
-- intent the original migration already expressed.
-- ------------------------------------------------------------
revoke insert, update, delete, truncate on public.groups from authenticated;
revoke insert, update, delete, truncate on public.group_members from authenticated;
revoke insert, update, delete, truncate on public.post_audience_groups from authenticated;

-- ------------------------------------------------------------
-- Reads
-- ------------------------------------------------------------
create or replace function public.admin_get_groups()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select case when not public.is_admin_user() then '[]'::jsonb else coalesce(
        (select jsonb_agg(jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'details', g.details,
            'created_at', g.created_at,
            'closed_at', g.closed_at,
            'creator_id', g.created_by,
            'creator_name', trim(coalesce(u.first_name, '') || ' ' ||
                                 coalesce(left(u.last_name, 1) || '.', '')),
            -- Live members only: removed rows are kept as the event record the
            -- feed banners derive from, not as membership.
            'member_count', (
                select count(*)::integer from public.group_members m
                where m.group_id = g.id and m.removed_at is null
            )
        ) order by g.created_at desc)
        from public.groups g
        join public.users u on u.id = g.created_by
        where g.deleted_at is null),
        '[]'::jsonb
    ) end;
$$;

create or replace function public.admin_get_group(p_group_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select case when not public.is_admin_user() then null else (
        select jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'details', g.details,
            'created_at', g.created_at,
            'closed_at', g.closed_at,
            'creator_id', g.created_by,
            'members', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'photo_url', u.photo_url,
                    'skill_level', u.skill_level,
                    'is_creator', (u.id = g.created_by)
                ) order by (u.id = g.created_by) desc, u.first_name)
                from public.group_members m
                join public.users u on u.id = m.user_id
                where m.group_id = g.id and m.removed_at is null and u.deleted_at is null
            ), '[]'::jsonb)
        )
        from public.groups g
        where g.id = p_group_id and g.deleted_at is null
    ) end;
$$;

-- ------------------------------------------------------------
-- Writes
-- ------------------------------------------------------------
create or replace function public.admin_add_group_member(p_group_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin_user() then
        return jsonb_build_object('success', false, 'error', 'Admins only');
    end if;

    if not exists (select 1 from public.groups where id = p_group_id and deleted_at is null) then
        return jsonb_build_object('success', false, 'error', 'Group not found');
    end if;

    if not exists (select 1 from public.users where id = p_user_id and deleted_at is null) then
        return jsonb_build_object('success', false, 'error', 'Player not found');
    end if;

    -- The PK is (group_id, user_id) and removals are STAMPED rather than
    -- deleted, so re-adding someone is an update of their existing row. A plain
    -- insert would fail on the key and read as "already a member" when in fact
    -- they had been removed.
    insert into public.group_members (group_id, user_id)
    values (p_group_id, p_user_id)
    on conflict (group_id, user_id) do update
        set removed_at = null, removed_by = null;

    return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_remove_group_member(p_group_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_remaining integer;
begin
    if not public.is_admin_user() then
        return jsonb_build_object('success', false, 'error', 'Admins only');
    end if;

    -- Stamp, never delete: the row is the event record the "you were removed"
    -- feed banner is derived from (20260804000004). removed_by is the ACTOR —
    -- the admin, not the member — which is what keeps removed_by_me false for
    -- them so they get the banner rather than the suppressed "you left" case.
    update public.group_members
    set removed_at = now(), removed_by = auth.uid()
    where group_id = p_group_id and user_id = p_user_id and removed_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Not a member of this group');
    end if;

    -- A group with nobody left in it is closed rather than left as a shell,
    -- matching what leave_group does when the last member goes.
    select count(*)::integer into v_remaining
    from public.group_members
    where group_id = p_group_id and removed_at is null;

    if v_remaining = 0 then
        update public.groups set deleted_at = now()
        where id = p_group_id and deleted_at is null;
    end if;

    return jsonb_build_object('success', true, 'group_emptied', v_remaining = 0);
end;
$$;

create or replace function public.admin_delete_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin_user() then
        return jsonb_build_object('success', false, 'error', 'Admins only');
    end if;

    -- Soft, like delete_group. can_see_post and get_feed's is_tagged both
    -- already require groups.deleted_at is null, so a deleted group stops
    -- granting access to private posts and stops tagging in the same statement.
    update public.groups set deleted_at = now()
    where id = p_group_id and deleted_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Group not found');
    end if;

    return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------
-- Grants. Supabase default-grants EXECUTE to anon directly, so revoking from
-- public alone leaves anon able to call these — revoke from both.
-- ------------------------------------------------------------
do $$
declare fn text;
begin
    foreach fn in array array[
        'public.admin_get_groups()',
        'public.admin_get_group(uuid)',
        'public.admin_add_group_member(uuid, uuid)',
        'public.admin_remove_group_member(uuid, uuid)',
        'public.admin_delete_group(uuid)'
    ] loop
        execute format('revoke all on function %s from public, anon', fn);
        execute format('grant execute on function %s to authenticated', fn);
    end loop;
end $$;
