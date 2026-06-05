-- Phase 8: Add original_cost to get_my_posts_with_claims RPC
-- and add post cancellation notification type

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
            'game_date', p.game_date,
            'game_time', p.game_time,
            'location', p.location,
            'custom_court', p.custom_court,
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

-- Cron job schedule for 48h unfilled nudge (run every 6 hours)
-- select cron.schedule('48h-unfilled-nudge', '0 */6 * * *', $$
--     select net.http_post(
--         url := 'https://[project].supabase.co/functions/v1/48h-unfilled-nudge',
--         headers := '{"Authorization": "Bearer [service_role_key]", "Content-Type": "application/json"}'::jsonb,
--         body := '{}'::jsonb
--     );
-- $$);

-- Cron job schedule for game reminders (run daily at 9 AM)
-- select cron.schedule('game-reminders', '0 9 * * *', $$
--     select net.http_post(
--         url := 'https://[project].supabase.co/functions/v1/game-reminders',
--         headers := '{"Authorization": "Bearer [service_role_key]", "Content-Type": "application/json"}'::jsonb,
--         body := '{}'::jsonb
--     );
-- $$);

-- Cron job schedule for friend expiry alerts (run every hour)
-- select cron.schedule('friend-expiry-alerts', '0 * * * *', $$
--     select net.http_post(
--         url := 'https://[project].supabase.co/functions/v1/friend-expiry-alerts',
--         headers := '{"Authorization": "Bearer [service_role_key]", "Content-Type": "application/json"}'::jsonb,
--         body := '{}'::jsonb
--     );
-- $$);

-- Cron job schedule for nudge unresponded claims (run every 4 hours)
-- select cron.schedule('nudge-unresponded-claims', '0 */4 * * *', $$
--     select net.http_post(
--         url := 'https://[project].supabase.co/functions/v1/nudge-unresponded-claims',
--         headers := '{"Authorization": "Bearer [service_role_key]", "Content-Type": "application/json"}'::jsonb,
--         body := '{}'::jsonb
--     );
-- $$);
