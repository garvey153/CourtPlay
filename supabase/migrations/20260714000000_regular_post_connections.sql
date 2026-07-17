-- ============================================================
-- Regular-post "connections" — a regular_game post is from ONE
-- person looking to join a group; responders tap Connect to
-- reach out. One post gets many responders (a claim = one
-- "connection", claim_messages = the thread), and there is no
-- approval step and no spot being consumed on the poster's side.
--
-- Two changes to submit_claim:
--  1. Drop the legacy single-arg submit_claim(uuid). With both
--     submit_claim(uuid) and submit_claim(uuid, text default null)
--     defined, PostgREST could not choose a candidate for a
--     single-arg call (PGRST203) — the Connect button hit this.
--     Only the two-arg version remains.
--  2. Skip the spots / "full" check for regular_game posts so any
--     number of responders can connect (regular posts default to
--     spots_total = 1, which otherwise blocks the 2nd responder).
-- Everything else in submit_claim is unchanged.
-- ============================================================

drop function if exists submit_claim(uuid);

create or replace function submit_claim(p_post_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_post record;
    v_conflict_date date;
    v_conflict_time time;
    v_claim_id uuid;
    v_spots_available integer;
    v_existing_claim_id uuid;
    v_is_regular boolean;
begin
    select * into v_post from public.posts
    where id = p_post_id and status = 'active' and deleted_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Post not found or no longer active');
    end if;

    v_is_regular := (v_post.post_type = 'regular_game');

    -- One connection/claim per responder per post.
    select id into v_existing_claim_id
    from public.claims
    where post_id = p_post_id and claimer_id = auth.uid() and status in ('pending', 'approved')
    limit 1;
    if found then
        return jsonb_build_object('success', false, 'error', 'You already have an active claim on this post');
    end if;

    -- Regular posts don't consume spots (many responders reach out to one seeker),
    -- so the spots/full check applies to sub_need posts only.
    if not v_is_regular then
        v_spots_available := greatest(0, v_post.spots_total - coalesce(
            (select count(*)::integer from public.claims c
             where c.post_id = p_post_id and c.status in ('pending', 'approved')), 0));
        if v_spots_available <= 0 then
            return jsonb_build_object('success', false, 'error', 'No spots available');
        end if;

        -- Time conflict: same user already booked at this exact date+time (dated subs only).
        select p2.game_date, p2.game_time into v_conflict_date, v_conflict_time
        from public.claims c
        join public.posts p2 on p2.id = c.post_id
        where c.claimer_id = auth.uid() and c.status in ('pending', 'approved')
          and p2.game_date = v_post.game_date and p2.game_time = v_post.game_time
          and c.post_id != p_post_id
        limit 1;
        if found then
            return jsonb_build_object('success', false, 'conflict', true,
                'conflict_date', v_conflict_date, 'conflict_time', v_conflict_time);
        end if;
    end if;

    insert into public.claims (post_id, claimer_id, status)
    values (p_post_id, auth.uid(), 'pending')
    returning id into v_claim_id;

    -- Store the responder's opening message, if any.
    if p_message is not null and length(trim(p_message)) > 0 then
        insert into public.claim_messages (claim_id, sender_id, body)
        values (v_claim_id, auth.uid(), trim(p_message));
    end if;

    return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$$;

grant execute on function submit_claim(uuid, text) to authenticated;
