-- The existing feed SELECT policy only exposes status='active' posts, so a poster
-- can't read back their own pending post. That broke INSERT ... RETURNING (the
-- `.select()` after insert) for custom-court posts, which are created as 'pending':
-- Postgres applies the SELECT policy to the returned row and raises
-- "new row violates row-level security policy for table posts".
--
-- Let authors read their own posts regardless of status (additive; existing
-- "read active posts" policy still applies via OR).
drop policy if exists "Users read own posts" on public.posts;
create policy "Users read own posts" on public.posts
  for select using (auth.uid() = author_id);
