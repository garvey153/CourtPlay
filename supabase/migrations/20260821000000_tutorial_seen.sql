-- When a player last looked at the tutorial.
--
-- Written when they finish or skip the post-onboarding carousel, and read by
-- the /tutorial route so it is idempotent: reloading it, or hitting back into
-- it, sends you on to where you were going rather than replaying.
--
-- timestamptz rather than boolean because it answers "did they" and "when",
-- and the second is what you want when asking whether the tutorial correlates
-- with activation.
--
-- Nullable with no default and NO BACKFILL. Existing players are not routed
-- here by anything, so they will not see it; showing it to them would be a
-- separate, deliberate decision.
--
-- No RLS change: the own-row select and update policies on public.users
-- already cover new columns, the same way feed_connected_only relies on.
alter table public.users
    add column if not exists tutorial_seen_at timestamptz;
