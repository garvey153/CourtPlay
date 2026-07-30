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

-- Cron job schedules moved to supabase/register_cron_jobs.sql.
--
-- The blocks that used to sit here had drifted badly enough to be actively
-- misleading: they named `48h-unfilled-nudge`, a slug Supabase rejects at deploy
-- time because it starts with a digit (the function 404'd in production for
-- months), and they embedded a literal service_role key in the job body, which
-- lands it in cron.job.command for anyone with database access to read.
--
-- The live definitions now pull the key from Supabase Vault at job run time.
-- See supabase/store_service_key_in_vault.sql then supabase/register_cron_jobs.sql.
