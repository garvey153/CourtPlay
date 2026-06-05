-- Fix submit_claim: add spots availability check and duplicate claim prevention
create or replace function submit_claim(p_post_id uuid)
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
begin
    -- Get the post
    select * into v_post from public.posts
    where id = p_post_id
      and status = 'active'
      and deleted_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Post not found or no longer active');
    end if;

    -- Check for duplicate active claim (same user, same post)
    select id into v_existing_claim_id
    from public.claims
    where post_id = p_post_id
      and claimer_id = auth.uid()
      and status in ('pending', 'approved')
    limit 1;

    if found then
        return jsonb_build_object('success', false, 'error', 'You already have an active claim on this post');
    end if;

    -- Check spots availability
    v_spots_available := greatest(0,
        v_post.spots_total - coalesce(
            (select count(*)::integer
             from public.claims c
             where c.post_id = p_post_id
               and c.status in ('pending', 'approved')),
            0
        )
    );

    if v_spots_available <= 0 then
        return jsonb_build_object('success', false, 'error', 'No spots available');
    end if;

    -- Check time conflict: same user already has a pending/approved claim
    -- at the exact same date+time (different post)
    select p2.game_date, p2.game_time
    into v_conflict_date, v_conflict_time
    from public.claims c
    join public.posts p2 on p2.id = c.post_id
    where c.claimer_id = auth.uid()
      and c.status in ('pending', 'approved')
      and p2.game_date = v_post.game_date
      and p2.game_time = v_post.game_time
      and c.post_id != p_post_id
    limit 1;

    if found then
        return jsonb_build_object(
            'success', false,
            'conflict', true,
            'conflict_date', v_conflict_date,
            'conflict_time', v_conflict_time
        );
    end if;

    -- Insert the claim
    insert into public.claims (post_id, claimer_id, status)
    values (p_post_id, auth.uid(), 'pending')
    returning id into v_claim_id;

    return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$$;
