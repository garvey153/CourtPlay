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

-- Cron jobs (run these in Supabase SQL editor with pg_cron enabled)
-- Note: Replace [project] and [service_role_key] with actual values

-- Auto-expire sub_need posts after game time passes (every 15 min)
-- select cron.schedule('auto-expire-posts', '*/15 * * * *', $$
--     update public.posts
--     set status = 'expired'
--     where status = 'active'
--       and post_type = 'sub_need'
--       and game_date is not null
--       and game_time is not null
--       and (game_date + game_time) < now()
-- $$);

-- Auto-expire regular_game posts after 30 days (daily at midnight)
-- select cron.schedule('expire-regular-game-posts', '0 0 * * *', $$
--     update public.posts
--     set status = 'expired'
--     where status = 'active'
--       and post_type = 'regular_game'
--       and expires_at is not null
--       and expires_at < now()
-- $$);
