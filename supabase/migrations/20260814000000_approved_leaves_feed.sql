-- Approved posts leave the feed.
--
-- Claimed-and-approved means the spot is gone and the game is arranged: the
-- poster tracks it under Activity -> Created, the claimer under Answered, and
-- the tagged group hears about it by notification. Leaving it in the feed just
-- means everyone scrolls past a game they cannot join.
--
-- Return shape is unchanged, so create-or-replace is enough; no drop needed.

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
          -- An approved claim ends the post's life in the feed. Until approval a
          -- filled post stays, wearing the Claimed badge, because a pending claim
          -- can still be declined or backed out of and the spot reopen — the feed
          -- is where someone would find it again.
          --
          -- Counts APPROVED only, and compares against spots_total: a post with
          -- two spots and one approved claim still has one to fill, and belongs
          -- in the feed.
          --
          -- sub_need only. On a regular_game post connections do not consume
          -- spots (many responders reach out to one seeker), so an approval
          -- there is not the post being filled — the seeker removes their own
          -- post when they have found a group. Same carve-out submit_claim makes.
          and (
              p.post_type = 'regular_game'
              or p.spots_total > coalesce(
                  (select count(*)::integer
                   from public.claims c
                   where c.post_id = p.id and c.status = 'approved'),
                  0
              )
          )
    )
    select * from feed_data
    order by
        is_connected desc,
        game_date asc nulls last,
        created_at desc
$$;

revoke all on function public.get_feed() from public, anon;
grant execute on function public.get_feed() to authenticated;
