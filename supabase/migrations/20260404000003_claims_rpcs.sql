-- ============================================================
-- Phase 4 — Claim flow RPCs + updated get_feed
-- ============================================================

-- Update get_feed to include caller's claim status and notify_me flag per post
create or replace function get_feed()
returns table (
    id uuid,
    author_id uuid,
    author_type text,
    post_type text,
    format text,
    total_players integer,
    game_date date,
    game_time time,
    skill_level text,
    location text,
    court_id uuid,
    custom_court text,
    pro_name text,
    cost numeric,
    original_cost numeric,
    spots_total integer,
    series_id uuid,
    notes text,
    status text,
    view_count integer,
    expires_at timestamptz,
    preferred_days text[],
    preferred_times text[],
    created_at timestamptz,
    first_name text,
    last_name text,
    photo_url text,
    is_friend boolean,
    spots_available integer,
    user_claim_status text,
    user_claim_id uuid,
    user_notify_me boolean
)
language sql
security definer
stable
as $$
    with feed_data as (
        select
            p.id,
            p.author_id,
            p.author_type,
            p.post_type,
            p.format,
            p.total_players,
            p.game_date,
            p.game_time,
            p.skill_level,
            p.location,
            p.court_id,
            p.custom_court,
            p.pro_name,
            p.cost,
            p.original_cost,
            p.spots_total,
            p.series_id,
            p.notes,
            p.status,
            p.view_count,
            p.expires_at,
            p.preferred_days,
            p.preferred_times,
            p.created_at,
            u.first_name,
            u.last_name,
            u.photo_url,
            exists(
                select 1 from public.follows f
                where f.follower_id = auth.uid()
                  and f.following_id = p.author_id
            ) as is_friend,
            greatest(0,
                p.spots_total - coalesce(
                    (select count(*)::integer
                     from public.claims c
                     where c.post_id = p.id
                       and c.status in ('pending', 'approved')),
                    0
                )
            ) as spots_available,
            (select c.status from public.claims c
             where c.post_id = p.id and c.claimer_id = auth.uid()
             order by c.created_at desc limit 1) as user_claim_status,
            (select c.id from public.claims c
             where c.post_id = p.id and c.claimer_id = auth.uid()
             order by c.created_at desc limit 1) as user_claim_id,
            exists(
                select 1 from public.notify_me nm
                where nm.post_id = p.id and nm.user_id = auth.uid()
            ) as user_notify_me
        from public.posts p
        join public.users u on u.id = p.author_id
        where p.status = 'active'
          and p.deleted_at is null
          and (p.expires_at is null or p.expires_at > now())
    )
    select * from feed_data
    order by
        game_date asc nulls last,
        is_friend desc,
        created_at desc
$$;

-- ============================================================
-- submit_claim — inserts a pending claim after conflict check
-- Returns jsonb: {success, conflict?, conflict_date?, conflict_time?, claim_id?}
-- ============================================================
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
begin
    -- Get the post
    select * into v_post from public.posts
    where id = p_post_id
      and status = 'active'
      and deleted_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Post not found or no longer active');
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

-- ============================================================
-- approve_claim — poster approves a pending claim
-- ============================================================
create or replace function approve_claim(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_claim record;
    v_response_hours numeric;
begin
    select c.id, c.claimer_id, c.created_at, p.author_id, p.id as post_id
    into v_claim
    from public.claims c
    join public.posts p on p.id = c.post_id
    where c.id = p_claim_id
      and c.status = 'pending';

    if not found then
        return jsonb_build_object('success', false, 'error', 'Claim not found or not pending');
    end if;

    if v_claim.author_id != auth.uid() then
        return jsonb_build_object('success', false, 'error', 'Not authorized');
    end if;

    update public.claims
    set status = 'approved', resolved_at = now()
    where id = p_claim_id;

    v_response_hours := extract(epoch from (now() - v_claim.created_at)) / 3600.0;

    insert into public.responsiveness_log (poster_id, post_id, claim_id, event_type, response_time_hours)
    values (auth.uid(), v_claim.post_id, p_claim_id, 'responded', v_response_hours);

    return jsonb_build_object('success', true);
end;
$$;

-- ============================================================
-- reject_claim — poster rejects a pending claim
-- ============================================================
create or replace function reject_claim(p_claim_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_claim record;
    v_response_hours numeric;
begin
    select c.id, c.claimer_id, c.created_at, p.author_id, p.id as post_id
    into v_claim
    from public.claims c
    join public.posts p on p.id = c.post_id
    where c.id = p_claim_id
      and c.status = 'pending';

    if not found then
        return jsonb_build_object('success', false, 'error', 'Claim not found or not pending');
    end if;

    if v_claim.author_id != auth.uid() then
        return jsonb_build_object('success', false, 'error', 'Not authorized');
    end if;

    update public.claims
    set status = 'rejected', rejection_reason = p_reason, resolved_at = now()
    where id = p_claim_id;

    v_response_hours := extract(epoch from (now() - v_claim.created_at)) / 3600.0;

    insert into public.responsiveness_log (poster_id, post_id, claim_id, event_type, response_time_hours)
    values (auth.uid(), v_claim.post_id, p_claim_id, 'responded', v_response_hours);

    return jsonb_build_object('success', true);
end;
$$;

-- ============================================================
-- unclaim — claimer backs out of a pending or approved claim
-- ============================================================
create or replace function unclaim(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
as $$
begin
    update public.claims
    set status = 'unclaimed', resolved_at = now()
    where id = p_claim_id
      and claimer_id = auth.uid()
      and status in ('pending', 'approved');

    if not found then
        return jsonb_build_object('success', false, 'error', 'Claim not found');
    end if;

    return jsonb_build_object('success', true);
end;
$$;

-- ============================================================
-- reopen_claim — poster cancels an approved claim (Scenario B)
-- ============================================================
create or replace function reopen_claim(p_claim_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_author_id uuid;
begin
    select p.author_id into v_author_id
    from public.claims c
    join public.posts p on p.id = c.post_id
    where c.id = p_claim_id
      and c.status = 'approved';

    if not found then
        return jsonb_build_object('success', false, 'error', 'Claim not found or not approved');
    end if;

    if v_author_id != auth.uid() then
        return jsonb_build_object('success', false, 'error', 'Not authorized');
    end if;

    update public.claims
    set status = 'cancelled', reopen_note = p_note, resolved_at = now()
    where id = p_claim_id;

    return jsonb_build_object('success', true);
end;
$$;

-- ============================================================
-- add_notify_me — watch a full post for reopening
-- ============================================================
create or replace function add_notify_me(p_post_id uuid)
returns jsonb
language plpgsql
security definer
as $$
begin
    insert into public.notify_me (user_id, post_id)
    values (auth.uid(), p_post_id)
    on conflict (user_id, post_id) do nothing;

    return jsonb_build_object('success', true);
end;
$$;

-- ============================================================
-- get_my_posts_with_claims — for Activity > My Posts tab
-- Returns posts authored by caller with pending/approved claims
-- ============================================================
create or replace function get_my_posts_with_claims()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    select coalesce(json_agg(post_row order by (post_row->>'created_at') desc), '[]')
    into result
    from (
        select jsonb_build_object(
            'id', p.id,
            'post_type', p.post_type,
            'format', p.format,
            'game_date', p.game_date,
            'game_time', p.game_time,
            'location', p.location,
            'custom_court', p.custom_court,
            'cost', p.cost,
            'spots_total', p.spots_total,
            'status', p.status,
            'created_at', p.created_at,
            'spots_available', greatest(0,
                p.spots_total - coalesce(
                    (select count(*)::integer from public.claims c2
                     where c2.post_id = p.id and c2.status in ('pending', 'approved')),
                    0
                )
            ),
            'claims', coalesce(
                (select json_agg(jsonb_build_object(
                    'id', c.id,
                    'status', c.status,
                    'created_at', c.created_at,
                    'claimer_id', c.claimer_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'photo_url', u.photo_url,
                    'skill_level', u.skill_level,
                    'venmo_handle', u.venmo_handle,
                    'phone', u.phone
                ) order by c.created_at asc)
                from public.claims c
                join public.users u on u.id = c.claimer_id
                where c.post_id = p.id
                  and c.status in ('pending', 'approved')),
                '[]'
            )
        ) as post_row
        from public.posts p
        where p.author_id = auth.uid()
          and p.deleted_at is null
    ) sub;

    return result;
end;
$$;

-- ============================================================
-- get_my_claims_with_posts — for Activity > My Claims tab
-- Returns caller's claims with post + poster info
-- ============================================================
create or replace function get_my_claims_with_posts()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    select coalesce(json_agg(claim_row order by (claim_row->>'created_at') desc), '[]')
    into result
    from (
        select jsonb_build_object(
            'id', c.id,
            'status', c.status,
            'created_at', c.created_at,
            'rejection_reason', c.rejection_reason,
            'post_id', p.id,
            'post_type', p.post_type,
            'format', p.format,
            'game_date', p.game_date,
            'game_time', p.game_time,
            'location', p.location,
            'custom_court', p.custom_court,
            'cost', p.cost,
            'poster_id', poster.id,
            'poster_first_name', poster.first_name,
            'poster_last_name', poster.last_name,
            'poster_photo_url', poster.photo_url,
            'poster_venmo_handle', poster.venmo_handle,
            'poster_phone', poster.phone
        ) as claim_row
        from public.claims c
        join public.posts p on p.id = c.post_id
        join public.users poster on poster.id = p.author_id
        where c.claimer_id = auth.uid()
    ) sub;

    return result;
end;
$$;
