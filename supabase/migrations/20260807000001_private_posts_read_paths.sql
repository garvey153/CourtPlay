-- ============================================================
-- Teach every path that hands out a post about visibility.
--
-- There are five, and three of them are `security definer`, which means they
-- BYPASS the RLS policy added in 20260807000000 entirely. Fixing the policy
-- alone would leave a private post readable through all three. In particular
-- get_post_by_id is anon-callable and, until now, applied no status check of
-- any kind — it is the /post/:id share link, and the easiest of the five to
-- forget.
--
-- The rule everywhere: a post the viewer cannot see is INDISTINGUISHABLE from
-- one that does not exist. get_post_by_id returns null, submit_claim returns
-- the same 'Post not found or no longer active' string it already uses. A
-- dedicated "this post is private" error would confirm the post exists to
-- anyone holding an id.
--
-- All five keep their existing signatures and bodies; only the visibility test
-- is added. get_feed's return shape is untouched, so create-or-replace works
-- here (unlike 20260806000000, which had to drop first).
-- ============================================================

-- ------------------------------------------------------------
-- 1. get_feed — the main list.
-- ------------------------------------------------------------
create or replace function public.get_feed()
returns table (
    id uuid,
    author_id uuid,
    author_type text,
    post_type text,
    format text,
    play_type text,
    duration numeric,
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
    is_connected boolean,
    spots_available integer,
    user_claim_status text,
    user_claim_id uuid,
    user_notify_me boolean
)
language sql
security definer
stable
set search_path = public
as $$
    with feed_data as (
        select
            p.id,
            p.author_id,
            p.author_type,
            p.post_type,
            p.format,
            p.play_type,
            p.duration,
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
            (
                exists(
                    select 1 from public.follows f
                    where f.follower_id = auth.uid()
                      and f.following_id = p.author_id
                )
                or exists(
                    select 1 from public.group_members gm
                    where gm.user_id = p.author_id
                      and gm.removed_at is null
                      -- Direct call, not a CTE: `= any((select ids from cte))` is the
                      -- subquery form of ANY, which compares against each ROW rather
                      -- than the array, giving "operator does not exist: uuid = uuid[]".
                      -- my_active_group_ids() is stable, so the planner may still hoist it.
                      and gm.group_id = any(public.my_active_group_ids())
                )
            ) as is_connected,
            greatest(0,
                p.spots_total - coalesce(
                    (select count(*)::integer
                     from public.claims c
                     where c.post_id = p.id
                       and c.status in ('pending', 'approved')),
                    0
                )
            ) as spots_available,
            (
                select c.status from public.claims c
                where c.post_id = p.id and c.claimer_id = auth.uid()
                order by c.created_at desc limit 1
            ) as user_claim_status,
            (
                select c.id from public.claims c
                where c.post_id = p.id and c.claimer_id = auth.uid()
                order by c.created_at desc limit 1
            ) as user_claim_id,
            exists(
                select 1 from public.notify_me nm
                where nm.post_id = p.id and nm.user_id = auth.uid()
            ) as user_notify_me
        from public.posts p
        join public.users u on u.id = p.author_id
        where p.status = 'active'
          and p.deleted_at is null
          and (p.expires_at is null or p.expires_at > now())
          and (
              p.game_date is null
              or ((p.game_date + coalesce(p.game_time, time '23:59')) at time zone 'America/New_York') > now()
          )
          and public.can_see_post(p.id)
    )
    select * from feed_data
    order by
        is_connected desc,
        game_date asc nulls last,
        created_at desc
$$;

revoke all on function public.get_feed() from public, anon;
grant execute on function public.get_feed() to authenticated;

-- ------------------------------------------------------------
-- 2. get_post_by_id — the share link. Anon-callable, and the reason the
--    "not found" wording matters: this is the path a forwarded link hits.
--    search_path is pinned here for the first time; every reference inside was
--    already schema-qualified, so this only closes the hole rather than
--    changing behaviour.
-- ------------------------------------------------------------
create or replace function public.get_post_by_id(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    result jsonb;
    v_uid uuid;
begin
    v_uid := auth.uid(); -- may be null for anonymous

    select jsonb_build_object(
        'id', p.id,
        'author_id', p.author_id,
        'author_type', p.author_type,
        'post_type', p.post_type,
        'format', p.format,
        'play_type', p.play_type,
        'duration', p.duration,
        'total_players', p.total_players,
        'game_date', p.game_date,
        'game_time', p.game_time,
        'skill_level', p.skill_level,
        'location', p.location,
        'court_id', p.court_id,
        'custom_court', p.custom_court,
        'pro_name', p.pro_name,
        'cost', p.cost,
        'original_cost', p.original_cost,
        'spots_total', p.spots_total,
        'series_id', p.series_id,
        'notes', p.notes,
        'status', p.status,
        'view_count', p.view_count,
        'expires_at', p.expires_at,
        'preferred_days', p.preferred_days,
        'preferred_times', p.preferred_times,
        'created_at', p.created_at,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'photo_url', u.photo_url,
        'is_friend', case when v_uid is not null then exists(
            select 1 from public.follows f
            where f.follower_id = v_uid and f.following_id = p.author_id
        ) else false end,
        'spots_available', greatest(0,
            p.spots_total - coalesce(
                (select count(*)::integer from public.claims c
                 where c.post_id = p.id and c.status in ('pending', 'approved')),
                0
            )
        ),
        'user_claim_status', case when v_uid is not null then (
            select c.status from public.claims c
            where c.post_id = p.id and c.claimer_id = v_uid
            order by c.created_at desc limit 1
        ) else null end,
        'user_claim_id', case when v_uid is not null then (
            select c.id from public.claims c
            where c.post_id = p.id and c.claimer_id = v_uid
            order by c.created_at desc limit 1
        ) else null end,
        'user_notify_me', case when v_uid is not null then exists(
            select 1 from public.notify_me nm
            where nm.post_id = p.id and nm.user_id = v_uid
        ) else false end
    ) into result
    from public.posts p
    join public.users u on u.id = p.author_id
    where p.id = p_post_id
      and p.deleted_at is null
      and public.can_see_post(p.id);

    return result;
end;
$$;

-- ------------------------------------------------------------
-- 3. get_profile — active_posts. Nothing renders this today (the Posts section
--    came off Profile in the groups rework), but the RPC still hands another
--    user's posts to any authenticated caller, so it leaks at the API even
--    while the UI shows nothing.
-- ------------------------------------------------------------
create or replace function public.get_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    result jsonb;
    v_uid uuid := auth.uid();
begin
    select jsonb_build_object(
        'id', u.id,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'headline', u.headline,
        'photo_url', u.photo_url,
        'skill_level', u.skill_level,
        'court_preferences', u.court_preferences,
        'new_to_westport', u.new_to_westport,
        'follower_count', (select count(*)::integer from public.follows f where f.following_id = u.id),
        'following_count', (select count(*)::integer from public.follows f where f.follower_id = u.id),
        'is_following', case when v_uid is not null then exists(
            select 1 from public.follows f where f.follower_id = v_uid and f.following_id = u.id
        ) else false end,
        'is_own_profile', (v_uid = u.id),
        'active_posts', coalesce(
            (select json_agg(jsonb_build_object(
                'id', p.id,
                'post_type', p.post_type,
                'format', p.format,
                'play_type', p.play_type,
                'duration', p.duration,
                'notes', p.notes,
                'status', p.status,
                'game_date', p.game_date,
                'game_time', p.game_time,
                'skill_level', p.skill_level,
                'location', p.location,
                'custom_court', p.custom_court,
                'cost', p.cost,
                'spots_total', p.spots_total,
                'spots_available', greatest(0,
                    p.spots_total - coalesce(
                        (select count(*)::integer from public.claims c
                         where c.post_id = p.id and c.status in ('pending', 'approved')),
                        0
                    )
                ),
                'created_at', p.created_at
            ) order by p.created_at desc)
            from public.posts p
            where p.author_id = u.id
              and p.status in ('active', 'expired')
              and p.deleted_at is null
              and (p.expires_at is null or p.expires_at > now())
              and (
                  p.game_date is null
                  or ((p.game_date + coalesce(p.game_time, time '23:59')) at time zone 'America/New_York')
                     + interval '24 hours' > now()
              )
              and public.can_see_post(p.id)),
            '[]'
        ),
        'following_list', coalesce(
            (select json_agg(jsonb_build_object(
                'id', fu.id,
                'first_name', fu.first_name,
                'last_name', fu.last_name,
                'photo_url', fu.photo_url,
                'skill_level', fu.skill_level
            ) order by fu.first_name)
            from public.follows f2
            join public.users fu on fu.id = f2.following_id
            where f2.follower_id = u.id
              and fu.deleted_at is null
              and fu.is_suspended = false),
            '[]'
        )
    ) into result
    from public.users u
    where u.id = p_user_id
      and u.deleted_at is null
      and u.is_suspended = false;

    return result;
end;
$$;

revoke all on function public.get_profile(uuid) from public, anon;
grant execute on function public.get_profile(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4 & 5. Acting on a post you cannot see. Both reuse the caller's existing
--    "not found" wording rather than a new error — the design line reads "Only
--    selected groups or players can claim", and a distinct message here would
--    hand the id-holder a confirmation that the post exists.
-- ------------------------------------------------------------
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
begin
    select * into v_post from public.posts
    where id = p_post_id and status = 'active' and deleted_at is null;

    -- Deliberately the SAME branch and message as "no such post". Splitting
    -- them out into a "this post is private" error would tell anyone holding an
    -- id that the post exists and who wrote it.
    if not found or not public.can_see_post(p_post_id) then
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

revoke all on function public.submit_claim(uuid, text) from public, anon;
grant execute on function public.submit_claim(uuid, text) to authenticated;

create or replace function public.add_notify_me(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.can_see_post(p_post_id) then
        return jsonb_build_object('success', false, 'error', 'Post not found');
    end if;

    insert into public.notify_me (user_id, post_id)
    values (auth.uid(), p_post_id)
    on conflict (user_id, post_id) do nothing;

    return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.add_notify_me(uuid) from public, anon;
grant execute on function public.add_notify_me(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. The expiry cron's feed. friend-expiry-alerts fans a post out to EVERY
--    follower of its author, which for a private post announces it to people
--    who were never in the audience.
--
--    Filtered here rather than in the edge function: this is the only source
--    the job has, so one clause covers it and any future caller. Private posts
--    get no expiry nudge at all — including for people who can see them. That
--    is the deliberate choice: the alternative is a second audience
--    calculation living in a cron job, which is exactly the kind of duplicated
--    visibility logic this phase exists to avoid.
-- ------------------------------------------------------------
create or replace function public.get_expiring_friend_posts(p_cutoff timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    result jsonb;
begin
    select coalesce(json_agg(jsonb_build_object(
        'id', p.id,
        'author_id', p.author_id
    )), '[]')
    into result
    from public.posts p
    where p.status = 'active'
      and p.post_type = 'sub_need'
      and p.deleted_at is null
      and p.visibility = 'public'
      and p.game_date is not null
      and p.game_time is not null
      and (p.game_date + p.game_time) <= p_cutoff
      and (p.game_date + p.game_time) > now()
      and p.spots_total > coalesce(
          (select count(*)::integer from public.claims c
           where c.post_id = p.id and c.status in ('pending', 'approved')),
          0
      );

    return result;
end;
$$;
