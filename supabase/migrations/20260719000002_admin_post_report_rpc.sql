-- Admin moderation: view a reported post together with its claim conversations.
-- claim_messages is RLS-restricted to the claim's participants, so an admin can't read
-- them directly. This SECURITY DEFINER RPC (admins only) returns the full post (same
-- shape as get_feed, works even after the post is removed) plus every claim thread that
-- has messages.
create or replace function public.admin_get_post_report(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post jsonb;
  v_conversations jsonb;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'not authorized';
  end if;

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
    'is_friend', false,
    'spots_available', greatest(0, p.spots_total - coalesce(
      (select count(*)::integer from public.claims c where c.post_id = p.id and c.status in ('pending', 'approved')), 0)),
    'user_claim_status', null,
    'user_claim_id', null,
    'user_notify_me', false
  ) into v_post
  from public.posts p
  join public.users u on u.id = p.author_id
  where p.id = p_post_id;

  select coalesce(jsonb_agg(conv order by claim_created), '[]'::jsonb)
  into v_conversations
  from (
    select
      c.created_at as claim_created,
      jsonb_build_object(
        'claim_id', c.id,
        'claimer_name', nullif(trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, '')), ''),
        'claim_status', c.status,
        -- Same shape as ClaimMessage so the frontend can reuse the feed's ThreadMessage.
        'messages', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', m.id,
            'sender_id', m.sender_id,
            'first_name', su.first_name,
            'last_name', su.last_name,
            'photo_url', su.photo_url,
            'body', m.body,
            'created_at', m.created_at
          ) order by m.created_at), '[]'::jsonb)
          from public.claim_messages m
          join public.users su on su.id = m.sender_id
          where m.claim_id = c.id
        )
      ) as conv
    from public.claims c
    join public.users cu on cu.id = c.claimer_id
    where c.post_id = p_post_id
      and exists (select 1 from public.claim_messages m where m.claim_id = c.id)
  ) sub;

  return jsonb_build_object('post', v_post, 'conversations', v_conversations);
end;
$$;

revoke execute on function public.admin_get_post_report(uuid) from public, anon;
grant execute on function public.admin_get_post_report(uuid) to authenticated;
