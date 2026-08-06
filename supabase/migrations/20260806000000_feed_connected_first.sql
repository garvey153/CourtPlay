-- ============================================================
-- Posts from your groups and the players you follow sort to the top.
--
-- get_feed already computed is_friend, but the ORDER BY read
--
--     game_date asc nulls last, is_friend desc, created_at desc
--
-- so is_friend only ever broke ties WITHIN a single date. A followed player's
-- game next Friday sorted below a stranger's game tomorrow, which is to say the
-- prioritisation was there but invisible. Leading with the new flag is what
-- makes "top of the feed" actually true.
--
-- is_connected is the broader question: do I follow this author, OR do we share
-- an active group. It does NOT replace is_friend — sub-card.tsx renders a
-- "Friend" badge from that, and the badge should stay follow-only rather than
-- lighting up for a group-mate you have never followed.
--
-- Group membership comes from my_active_group_ids(), so closed groups drop out
-- automatically and membership stays defined in the two helpers from
-- 20260804000002 rather than being spelled out a third time here.
--
-- Note "posts from my groups" can only mean "posts by someone who shares a
-- group with me": posts have no group linkage yet. Posts actually addressed to
-- a group arrive with the audience work.
--
-- drop + create rather than create or replace: the return-table shape changes,
-- which replace refuses. Precedent: 20260704000000_get_feed_claim_status.sql.
-- ============================================================

drop function if exists public.get_feed();

create function public.get_feed()
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
    )
    select * from feed_data
    order by
        is_connected desc,
        game_date asc nulls last,
        created_at desc
$$;

-- Restore the grants the drop took with it. anon was deliberately revoked in
-- 20260730000000_revoke_anon_execute_on_rpcs.sql — get_feed reads users, so it
-- must not be re-granted here.
revoke all on function public.get_feed() from public, anon;
grant execute on function public.get_feed() to authenticated;

-- ------------------------------------------------------------
-- The opt-in: limit the feed to connected posts, permanently.
--
-- A column on users rather than a preferences row: it is a profile setting, and
-- notification_preferences is specifically the per-type email/push matrix.
-- First user-level settings column in the schema; new_to_westport is the
-- existing boolean precedent. Own-row select and update policies already cover
-- it, so no policy change.
-- ------------------------------------------------------------
alter table public.users
    add column if not exists feed_connected_only boolean not null default false;
