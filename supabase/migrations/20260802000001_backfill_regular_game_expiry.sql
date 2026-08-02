-- ============================================================
-- Backfill expires_at on legacy regular_game posts.
--
-- regular_game posts get expires_at = created_at + 30 days at
-- creation, but that only started between 2026-07-03 and
-- 2026-07-06. Every regular_game post created before then has
-- expires_at = null, and null means "never expires" in all three
-- places that matter: get_feed, get_profile (as of 20260802000000)
-- and expire-regular-game-posts, which guards on
-- `expires_at is not null`. Eight active posts, the oldest from
-- 2026-04-06, were therefore pinned in the feed permanently with
-- nothing able to age them out.
--
-- Given a fresh 30-day window rather than created_at + 30 days:
-- every one of them is already past that mark (the newest, from
-- 2026-07-03, hit it on 2026-08-02), so backdating would have
-- yanked all eight out of the feed at once with no warning to
-- their authors. Letting them lapse over the coming month is the
-- gentler correction and reaches the same end state.
--
-- Guarded on `expires_at is null`, so re-running never extends a
-- post that already has an expiry.
--
-- Note: five of the eight are dummy rows from seed_dummy_data.sql
-- that reached production (ids e0000000-…-0000000000NN). They are
-- included deliberately — excluding them would leave exactly the
-- never-expires gap this migration exists to close. Removing seed
-- data from production is tracked separately.
-- ============================================================

update public.posts
set expires_at = now() + interval '30 days'
where post_type = 'regular_game'
  and status = 'active'
  and expires_at is null
  and deleted_at is null;
