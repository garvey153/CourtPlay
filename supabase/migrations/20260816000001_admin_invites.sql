-- Reading and managing the invite list from Admin.
--
-- Every function here is security definer and therefore bypasses RLS, so the
-- is_admin_user() guard IS the access control. There is no second line.

-- The list, with who invited them and whether they joined. Emails are the whole
-- point of this screen, so it is admin-only and returns nothing otherwise —
-- matching admin_get_groups' shape rather than raising.
create or replace function public.admin_get_invites()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
    select case when not public.is_admin_user() then '[]'::jsonb else coalesce(
        (select jsonb_agg(row_to_json(t) order by t.sent_at desc)
         from (
            select i.id,
                   lower(btrim(i.email)) as email,
                   i.source,
                   i.sent_at,
                   i.accepted_at,
                   i.accepted_user_id,
                   -- The inviter's name, or null for a seeded row.
                   nullif(btrim(coalesce(inv.first_name, '') || ' ' || coalesce(inv.last_name, '')), '')
                       as inviter_name,
                   -- Who took it up, which is not always who was invited: the
                   -- gate matches on address, and the accepted stamp records the
                   -- account that actually used it.
                   nullif(btrim(coalesce(acc.first_name, '') || ' ' || coalesce(acc.last_name, '')), '')
                       as accepted_name
            from public.invites i
            left join public.users inv on inv.id = i.inviter_id
            left join public.users acc on acc.id = i.accepted_user_id
         ) t),
        '[]'::jsonb) end;
$$;

revoke all on function public.admin_get_invites() from public, anon;
grant execute on function public.admin_get_invites() to authenticated;

-- Take an address off the list. Refuses once it has been accepted: the row is
-- then the record of how a member got in, and deleting it would also strand
-- them if their profile were ever recreated.
create or replace function public.admin_revoke_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_accepted timestamptz;
begin
    if not public.is_admin_user() then
        return jsonb_build_object('success', false, 'error', 'Admins only');
    end if;

    select accepted_at into v_accepted from public.invites where id = p_invite_id;
    if not found then
        return jsonb_build_object('success', false, 'error', 'No such invite');
    end if;
    if v_accepted is not null then
        return jsonb_build_object('success', false,
            'error', 'They have already joined. Suspend the player instead.');
    end if;

    delete from public.invites where id = p_invite_id;
    return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.admin_revoke_invite(uuid) from public, anon;
grant execute on function public.admin_revoke_invite(uuid) to authenticated;
