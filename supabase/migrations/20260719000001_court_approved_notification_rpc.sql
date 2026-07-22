-- The "your custom court was approved" feed banner is driven by an unread
-- post_court_approved row in notifications. Relying on the edge function to write that
-- row is unreliable (it only inserts when push/email actually delivers). Record it
-- directly during approval instead.
--
-- Admins can't otherwise write another user's notifications row (RLS only allows a user
-- to read/update their own), so expose an admin-only SECURITY DEFINER RPC.

-- Add an 'in_app' channel for notifications surfaced only in the app (no push/email).
alter table public.notifications drop constraint if exists notifications_channel_check;
alter table public.notifications
  add constraint notifications_channel_check check (channel in ('push', 'email', 'sms', 'in_app'));

create or replace function public.record_court_approved_notification(p_user_id uuid, p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admins approve courts.
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'not authorized';
  end if;

  insert into public.notifications (user_id, type, post_id, channel, read)
  values (p_user_id, 'post_court_approved', p_post_id, 'in_app', false);
end;
$$;

revoke execute on function public.record_court_approved_notification(uuid, uuid) from public, anon;
grant execute on function public.record_court_approved_notification(uuid, uuid) to authenticated;
