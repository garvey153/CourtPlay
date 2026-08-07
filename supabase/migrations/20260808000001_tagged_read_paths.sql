-- ============================================================
-- Surface the tag to the viewer.
--
-- is_tagged answers "am I one of the people this sub is playing with", which is
-- what swaps the feed card into its dimmed variant and the detail sheet into
-- the no-claim one. It is NOT a visibility flag — can_see_post already decided
-- that in 20260808000000, and a false is_tagged on a visible post is the normal
-- case, not a denial.
--
-- get_feed's return shape changes, so it needs drop + create rather than
-- create-or-replace. Precedent: 20260806000000_feed_connected_first.sql.
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
    is_tagged boolean,
    tagged_group_name text,
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
            (
                p.tagged_group_id is not null
                -- The author is normally in the group they tagged, but they are
                -- never a tagged VIEWER: this is their own ask, and dimming it
                -- would hide the price and the status from the one person who
                -- manages the claims on it.
                and p.author_id <> auth.uid()
                and exists(
                    select 1 from public.group_members gm
                    join public.groups g2 on g2.id = gm.group_id
                    where gm.group_id = p.tagged_group_id
                      and gm.user_id = auth.uid()
                      and gm.removed_at is null
                      -- Must match can_see_post's tagged clause. Without it a
                      -- PUBLIC post keeps showing the tagged variant for a
                      -- deleted group: access comes from the post being public,
                      -- so the missing check never surfaces as a denial.
                      -- Closed is deliberately not checked — a closed group is
                      -- a tombstone for posting to, not for a game arranged.
                      and g2.deleted_at is null
                )
            ) as is_tagged,
            -- Carried on the feed row so the tagged sheet can name the group
            -- without a second round trip when opened from the feed. Scoped to
            -- members of that group, exactly like is_tagged, so it discloses
            -- nothing the flag doesn't already.
            (
                select g2.name from public.groups g2
                where g2.id = p.tagged_group_id
                  and g2.deleted_at is null
                  and p.author_id <> auth.uid()
                  and exists(
                      select 1 from public.group_members gm2
                      where gm2.group_id = p.tagged_group_id
                        and gm2.user_id = auth.uid()
                        and gm2.removed_at is null
                  )
            ) as tagged_group_name,
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
-- get_post_by_id also carries the group NAME, for the sheet's footnote
-- ("Chris B. tagged The Racquettes group on this post"). The name is only
-- disclosed to someone already inside that group, so it adds no reach beyond
-- what is_tagged already implies.
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
        -- Same rule as get_feed: the author is not a tagged viewer of their own
        -- post, so their sheet stays the poster's one.
        'is_tagged', case when v_uid is not null then (
            p.tagged_group_id is not null and p.author_id <> v_uid and exists(
                select 1 from public.group_members gm
                join public.groups g2 on g2.id = gm.group_id
                where gm.group_id = p.tagged_group_id
                  and gm.user_id = v_uid
                  and gm.removed_at is null
                  and g2.deleted_at is null
            )
        ) else false end,
        'tagged_group_name', case when v_uid is not null then (
            select g.name from public.groups g
            where g.id = p.tagged_group_id
              and g.deleted_at is null
              and p.author_id <> v_uid
              and exists(
                  select 1 from public.group_members gm
                  where gm.group_id = p.tagged_group_id
                    and gm.user_id = v_uid
                    and gm.removed_at is null
              )
        ) else null end,
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
-- The feed banners' data source.
--
-- Banners in this app are DERIVED from state the feed already fetched rather
-- than read from an events table — see the group-banner.tsx docblock for why.
-- Tagged posts had no such source, so this is it: posts whose tagged group I am
-- in, with the latest claim's status and claimer name, which is everything the
-- "claimed" and "approved" banners need.
--
-- Bounded to posts whose game has not yet passed: a banner about a game that
-- already happened is noise, and without the bound this grows forever.
-- ------------------------------------------------------------
create or replace function public.get_my_tagged_posts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
    from (
        select
            p.id,
            p.play_type,
            p.format,
            p.game_date,
            p.game_time,
            p.location,
            p.custom_court,
            p.created_at,
            g.name as group_name,
            u.first_name as poster_first_name,
            c.id as claim_id,
            c.status as claim_status,
            cu.first_name as claimer_first_name
        from public.posts p
        join public.groups g on g.id = p.tagged_group_id
        join public.users u on u.id = p.author_id
        join public.group_members gm
             on gm.group_id = p.tagged_group_id
            and gm.user_id = auth.uid()
            and gm.removed_at is null
        -- The claim that decides the banner: the live one, newest first.
        left join lateral (
            select c2.id, c2.status, c2.claimer_id
            from public.claims c2
            where c2.post_id = p.id
              and c2.status in ('pending', 'approved')
            order by c2.created_at desc
            limit 1
        ) c on true
        left join public.users cu on cu.id = c.claimer_id
        where p.status = 'active'
          and p.deleted_at is null
          and g.deleted_at is null
          and p.author_id <> auth.uid()
          and (
              p.game_date is null
              or ((p.game_date + coalesce(p.game_time, time '23:59')) at time zone 'America/New_York') > now()
          )
    ) t;
$$;

revoke all on function public.get_my_tagged_posts() from public, anon;
grant execute on function public.get_my_tagged_posts() to authenticated;
