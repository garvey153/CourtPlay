-- Let a post's creator undo an approval (approved → pending) so they can re-decide.
create or replace function cancel_approval(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_claim record;
begin
    select c.id, p.author_id
    into v_claim
    from public.claims c
    join public.posts p on p.id = c.post_id
    where c.id = p_claim_id
      and c.status = 'approved';

    if not found then
        return jsonb_build_object('success', false, 'error', 'Claim not found or not approved');
    end if;

    if v_claim.author_id != auth.uid() then
        return jsonb_build_object('success', false, 'error', 'Not authorized');
    end if;

    update public.claims
    set status = 'pending', resolved_at = null
    where id = p_claim_id;

    return jsonb_build_object('success', true);
end;
$$;

grant execute on function cancel_approval(uuid) to authenticated;
