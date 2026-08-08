-- Copy only: the refusal message, reworded to match the sheet. The rule is
-- unchanged from 20260811000000.
--
-- Claiming a sub spot requires being rated at or above the game's NTRP level.
--
-- Any amount below is refused: a 3.5 may not claim a 4.0 game. Playing UP is
-- never restricted — the poster is protected from players rated below the
-- game, not above it.
--
-- The sheet disables its claim button on the same rule, but a disabled button
-- is a hint. This is the boundary, and it follows the tagged-member refusal
-- immediately above it: same shape, same {success:false, error} contract.
--
-- sub_need ONLY. On a regular_game post the skill level is the SEEKER's own
-- rating, not a requirement — they are looking to join someone's group — so
-- applying the floor there would block the wrong side of the transaction.
--
-- A null level on either side does not block. Missing data means the rule
-- cannot be evaluated, and locking a player out of every game over an absent
-- rating is worse than letting the poster decline the claim.

create or replace function public.submit_claim(p_post_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_post record;
    v_conflict_date date;
    v_conflict_time time;
    v_claim_id uuid;
    v_spots_available integer;
    v_existing_claim_id uuid;
    v_is_regular boolean;
    v_claimer_level numeric;
    v_claimer_text text;
    v_post_level numeric;
begin
    select * into v_post from public.posts
    where id = p_post_id and status = 'active' and deleted_at is null;

    -- Deliberately the SAME branch and message as "no such post". Splitting
    -- them out into a "this post is private" error would tell anyone holding an
    -- id that the post exists and who wrote it.
    if not found or not public.can_see_post(p_post_id) then
        return jsonb_build_object('success', false, 'error', 'Post not found or no longer active');
    end if;

    -- Tagged = already playing. The sheet offers them no claim button; this is
    -- the same rule at the boundary.
    if v_post.tagged_group_id is not null
       and public.is_group_member(v_post.tagged_group_id, auth.uid()) then
        return jsonb_build_object('success', false, 'error', 'You''re already playing in this game');
    end if;

    v_is_regular := (v_post.post_type = 'regular_game');

    -- NTRP floor: at or above the game's level. sub_need only.
    if not v_is_regular then
        -- The raw text as well as the number: the message shows the rating as
        -- the profile stores it ("3.5"), and numeric formatting is a needless
        -- way to turn that into "3.50".
        select skill_level, skill_level::numeric into v_claimer_text, v_claimer_level
        from public.users where id = auth.uid();
        v_post_level := v_post.skill_level::numeric;

        if v_claimer_level is not null and v_post_level is not null
           and v_claimer_level < v_post_level then
            return jsonb_build_object('success', false,
                'error', 'Sorry! This game is for NTRP ' || v_post.skill_level ||
                         ' and up. Your ' || v_claimer_text ||
                         ' will have to sit this one out.');
        end if;
    end if;

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

revoke execute on function public.submit_claim(uuid, text) from public, anon;
grant execute on function public.submit_claim(uuid, text) to authenticated;
