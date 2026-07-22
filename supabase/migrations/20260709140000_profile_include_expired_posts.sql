-- ============================================================
-- Profile "Posts" section — include Expired posts alongside
-- Open/Claimed. The section renders the user's Open, Claimed,
-- and Expired posts (the SubCard derives which from status +
-- spots + game time). Open/Claimed posts are status = 'active';
-- Expired posts are status = 'expired'. Deleted posts stay
-- excluded.
--
-- Dated posts (sub_need) drop off the profile 24h after their
-- game date/time passes — matching the feed. game_date/game_time
-- are stored as Westport-local (America/New_York) wall-clock, so
-- interpret them in that zone before comparing to now(). Undated
-- regular-game posts (game_date is null) are unaffected.
-- Everything else in get_profile is unchanged.
-- ============================================================

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
