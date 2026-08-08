-- ============================================================
-- The admin group editor became the Edit group screen, so it needs the same
-- shape of write: one atomic save of name, details and the whole roster.
--
-- That replaces the two per-member RPCs from 20260809000000. They applied
-- immediately, which is wrong for a form with a Save button — an admin who
-- removed three people and then hit Cancel had already removed them.
-- ============================================================

drop function if exists public.admin_add_group_member(uuid, uuid);
drop function if exists public.admin_remove_group_member(uuid, uuid);

create or replace function public.admin_update_group(
    p_group_id uuid,
    p_name text,
    p_details text default null,
    p_member_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_group record;
    v_members uuid[];
begin
    if not public.is_admin_user() then
        return jsonb_build_object('success', false, 'error', 'Admins only');
    end if;

    select * into v_group from public.groups
    where id = p_group_id and deleted_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Group not found');
    end if;

    if coalesce(btrim(p_name), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Give the group a name');
    end if;

    -- The group's OWN creator is forced back in, not the caller. update_group
    -- appends auth.uid() because there the caller IS the creator; here the
    -- caller is an admin who is very likely not a member at all, and appending
    -- them would quietly add them to every group they touched.
    select array_agg(distinct u.id) into v_members
    from public.users u
    where u.id = any(coalesce(p_member_ids, '{}') || v_group.created_by)
      and u.deleted_at is null
      and u.is_suspended = false;

    -- No duplicate-group check. find_duplicate_group is scoped to
    -- my_active_group_ids() — the CALLER's groups — so for an admin editing
    -- someone else's group it would compare against the wrong set entirely.
    -- Refusing a moderation edit because the admin happens to have a group with
    -- the same members would be nonsense.

    update public.groups
    set name = btrim(p_name),
        details = nullif(btrim(coalesce(p_details, '')), '')
    where id = p_group_id;

    -- Stamp, never delete: the row is the event record the removed player's
    -- feed banner derives from. removed_by is the admin — the ACTOR — which is
    -- what keeps removed_by_me false for them so they get "you were removed"
    -- rather than the suppressed "you left".
    update public.group_members
    set removed_at = now(), removed_by = auth.uid()
    where group_id = p_group_id and removed_at is null and user_id <> all(v_members);

    insert into public.group_members (group_id, user_id)
    select p_group_id, unnest(v_members)
    on conflict (group_id, user_id) do update
        set removed_at = null, removed_by = null, created_at = now();

    return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.admin_update_group(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.admin_update_group(uuid, text, text, uuid[]) to authenticated;
