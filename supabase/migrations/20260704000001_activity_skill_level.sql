-- Surface the post's skill_level + notes in the Activity RPCs so the Activity
-- cards match the feed subtitle ("… · NTRP x · …") and the detail bottom sheets
-- can show the poster's note. Both RPCs already return the other post fields.

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
            'play_type', p.play_type,
            'duration', p.duration,
            'skill_level', p.skill_level,
            'notes', p.notes,
            'game_date', p.game_date,
            'game_time', p.game_time,
            'location', p.location,
            'custom_court', p.custom_court,
            'preferred_days', p.preferred_days,
            'preferred_times', p.preferred_times,
            'cost', p.cost,
            'original_cost', p.original_cost,
            'spots_total', p.spots_total,
            'status', p.status,
            'created_at', p.created_at,
            'series_id', p.series_id,
            'deleted_at', p.deleted_at,
            'deleted_by', p.deleted_by,
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
    ) sub;

    return result;
end;
$$;

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
            'post_status', p.status,
            'format', p.format,
            'play_type', p.play_type,
            'duration', p.duration,
            'skill_level', p.skill_level,
            'notes', p.notes,
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
