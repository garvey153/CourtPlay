-- ============================================================
-- Feed — drop dated (sub_need) posts 24h after their game
-- date/time passes. Previously dated posts had expires_at = null
-- and so never aged out of the feed; only undated regular-game
-- posts expired (via expires_at = created_at + 30d).
--
-- game_date/game_time are stored as Westport-local wall-clock
-- (America/New_York), so interpret them in that zone before
-- comparing to now(). game_time can be null → fall back to
-- end-of-day (23:59), matching the SubCard's gameEndMs(). Undated
-- posts (game_date is null) keep the existing expires_at rule.
--
-- Only the WHERE clause changed; the rest of get_feed is a
-- verbatim reproduction of the prior definition.
-- ============================================================
drop function if exists get_feed();
create function get_feed()
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
              or ((p.game_date + coalesce(p.game_time, time '23:59')) at time zone 'America/New_York')
                 + interval '24 hours' > now()
          )
    )
    select * from feed_data
    order by
        game_date asc nulls last,
        is_friend desc,
        created_at desc
$$;

grant execute on function get_feed() to authenticated, anon;
