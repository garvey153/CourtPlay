-- ============================================================
-- Expiry timing fixes — sub_need at game start, regular_game
-- off the profile at expires_at.
--
-- Three components each decided expiry independently and none of
-- them agreed:
--
--   * auto-expire-posts compared a naive (game_date + game_time)
--     against now() in a UTC session. game_date/game_time are
--     Westport-local wall-clock, so a 6pm NY game was read as
--     18:00 UTC — 2pm NY. The job flipped posts to 'expired' four
--     hours BEFORE the game started (five under EST), and because
--     get_feed gates on status = 'active', the post vanished from
--     the feed before the game it was advertising.
--   * get_feed carried a 24h post-game grace window that could
--     therefore never take effect — the cron always pre-empted it.
--   * get_profile never checked expires_at, so a regular_game post
--     stayed on its author's profile forever while dropping out of
--     the feed at the 30-day mark.
--
-- After this migration all three read game_date/game_time the same
-- way (America/New_York, null time coalesced to 23:59, matching the
-- SubCard's gameEndMs) and sub_need posts leave the feed exactly at
-- game start.
--
-- Profile behaviour for sub_need posts is deliberately unchanged:
-- get_profile still shows them (as Expired) for 24h after the game,
-- which is what 20260709140000 added them for.
-- ============================================================

-- ------------------------------------------------------------
-- 1. auto-expire-posts — expire at game start, in New York.
--
-- alter_job rather than unschedule + schedule: it preserves the
-- jobid and the postgres ownership, and cron_run_log is keyed by
-- job name so history survives either way. coalesce on game_time
-- so a dated post with no time expires at end of day instead of
-- never — the same fallback get_feed and get_profile already use.
-- ------------------------------------------------------------
select cron.alter_job(
    (select jobid from cron.job where jobname = 'auto-expire-posts'),
    command := $cmd$
    update public.posts
    set status = 'expired'
    where status = 'active'
      and post_type = 'sub_need'
      and game_date is not null
      and ((game_date + coalesce(game_time, time '23:59')) at time zone 'America/New_York') < now()
$cmd$
);

-- ------------------------------------------------------------
-- 2. get_feed — drop the 24h grace so the feed clears at game
-- start rather than trailing the cron's 15-minute tick.
--
-- create or replace, not drop + create: the original migration
-- granted execute to anon, which was later revoked deliberately
-- (get_feed reads users). Replacing in place preserves the current
-- ACL — postgres, authenticated, service_role — where a drop would
-- reinstate anon from the old grant line.
--
-- Only the WHERE clause changed from 20260709150000.
-- ------------------------------------------------------------
create or replace function get_feed()
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
    )
    select * from feed_data
    order by
        game_date asc nulls last,
        is_friend desc,
        created_at desc
$$;

-- ------------------------------------------------------------
-- 3. get_profile — clear regular_game posts at expires_at, the
-- same gate the feed uses. sub_need posts never set expires_at
-- (0 of 37 in production), so this only affects regular_game;
-- their 24h post-game window is untouched.
-- ------------------------------------------------------------
create or replace function get_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
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
              )),
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
