-- Posts created under a custom (non-master) court are held in a 'pending' state,
-- hidden from the feed, until an admin approves or rejects the court on the
-- admin Courts tab. Extend the status check constraint to allow 'pending'.
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts
  add constraint posts_status_check
  check (status in ('active', 'pending', 'expired', 'deleted'));
