-- Phase 11: Add post_status to get_my_claims_with_posts
-- Needed to distinguish reopen-cancelled claims (Scenario B) from post-deletion-cancelled claims

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
