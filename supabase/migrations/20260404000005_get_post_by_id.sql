-- Get a single post by ID with the same shape as get_feed()
-- Semi-public: works for both authenticated and anonymous callers
create or replace function get_post_by_id(p_post_id uuid)
returns jsonb
language plpgsql
security definer
stable
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
      and p.deleted_at is null;

    return result;
end;
$$;
