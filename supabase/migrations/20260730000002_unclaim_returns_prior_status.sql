-- ============================================================
-- Tell the poster when a claimer withdraws.
--
-- Cancelling a claim has never notified anyone. `handleCancel` in
-- claim-detail-sheet calls unclaim() and then just refreshes the feed — checked
-- the file's history, and no dispatch has ever been there. So a poster whose
-- spot was claimed and then dropped finds out by noticing, which is the case
-- that matters most: the spot is open again and they don't know.
--
-- Two notification types already exist for this and neither had a caller:
-- claimer_cancelled (N7, "Someone cancelled their claim") for a pending claim,
-- and claimer_backed_out (N4, "Someone backed out of their spot") for an
-- approved one. Both are already in TEMPLATES and in the preferences UI.
--
-- Choosing between them needs the claim's status *before* the update, and
-- unclaim sets both cases to 'unclaimed' and returned only {success}. Having the
-- client read the claim first would be a second round trip and a race, so the
-- function reports it instead.
-- ============================================================

create or replace function public.unclaim(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prior_status text;
begin
    -- Read and lock before updating. `update … returning status` would hand back
    -- the new value ('unclaimed') for both cases, which is exactly the
    -- distinction being sought, and `for update` keeps the status from changing
    -- between the two statements.
    select status into v_prior_status
    from public.claims
    where id = p_claim_id
      and claimer_id = auth.uid()
      and status in ('pending', 'approved')
    for update;

    -- Same shape as before for the not-found case: the caller isn't the claimer,
    -- the claim doesn't exist, or it was already resolved.
    if v_prior_status is null then
        return jsonb_build_object('success', false, 'error', 'Claim not found');
    end if;

    update public.claims
    set status = 'unclaimed', resolved_at = now()
    where id = p_claim_id;

    return jsonb_build_object('success', true, 'prior_status', v_prior_status);
end;
$$;

-- Lock to authenticated: Supabase default-grants anon directly, so revoke that
-- too. (20260730000000 already did this for every function; repeated here
-- because create-or-replace on an existing function keeps its grants, but a
-- future drop-and-create would not.)
revoke all on function public.unclaim(uuid) from public, anon;
grant execute on function public.unclaim(uuid) to authenticated;
