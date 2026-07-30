-- Helper RPC for friend expiry alert Edge Function
create or replace function get_expiring_friend_posts(p_cutoff timestamptz)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    result jsonb;
begin
    select coalesce(json_agg(jsonb_build_object(
        'id', p.id,
        'author_id', p.author_id
    )), '[]')
    into result
    from public.posts p
    where p.status = 'active'
      and p.post_type = 'sub_need'
      and p.deleted_at is null
      and p.game_date is not null
      and p.game_time is not null
      and (p.game_date + p.game_time) <= p_cutoff
      and (p.game_date + p.game_time) > now()
      and p.spots_total > coalesce(
          (select count(*)::integer from public.claims c
           where c.post_id = p.id and c.status in ('pending', 'approved')),
          0
      );

    return result;
end;
$$;

-- Cron job schedules moved to supabase/register_cron_jobs.sql.
--
-- `auto-expire-posts` was the only one of these ever actually registered.
-- `expire-regular-game-posts` was not, which meant regular_game posts with a
-- past expires_at stayed 'active' indefinitely and kept appearing in the feed;
-- it is registered as of 2026-07-29.
--
-- See supabase/register_cron_jobs.sql for the live definitions.
