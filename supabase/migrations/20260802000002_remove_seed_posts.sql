-- ============================================================
-- Remove seed_dummy_data.sql posts from production.
--
-- 20 posts with ids e0000000-0000-0000-0000-0000000000NN reached
-- production from the dev seed file. Five were still active and
-- appearing in the live feed; the other 15 were expired but still
-- listed in Admin.
--
-- Soft delete, matching exactly what the app's own delete does
-- (feed.tsx sets status/deleted_at/deleted_by): reversible, and it
-- preserves the 68 claims made against these posts during testing
-- rather than cascading them away. derivePostState already maps
-- status='deleted' to the "Cancelled" badge, so Activity renders
-- these coherently instead of showing a gap.
--
-- Consequence worth knowing: soft-deleted posts still appear in
-- Admin, which deliberately lists every post regardless of status.
-- They show there as deleted. Only a hard delete removes them from
-- Admin, and that would take the test claims with it.
--
-- deleted_by is the admin who authorised this (is_admin = true),
-- resolved through a subquery so the migration is a no-op on a
-- database where that user does not exist rather than failing the
-- foreign key.
--
-- No third party is affected: all 68 claims on these posts belong
-- to that same admin account from testing. No notify_me rows from
-- anyone else, and the one report against a seed post is theirs.
-- ============================================================

update public.posts
set status     = 'deleted',
    deleted_at = now(),
    deleted_by = (select id from public.users
                  where id = 'a094469c-1fa0-418f-9b5f-06288721eb85')
where id::text like 'e0000000-0000-0000-0000-%'
  and deleted_at is null;

-- A pending or approved claim must not outlive its post. isReopenedClaim
-- distinguishes the two cancellation causes by whether the post is still
-- active, so cancelling here reads correctly as a post deletion rather
-- than a reopened spot. One pending claim at time of writing; the other
-- 67 are already unclaimed or cancelled and are left untouched.
update public.claims
set status      = 'cancelled',
    resolved_at = now()
where post_id in (
        select id from public.posts
        where id::text like 'e0000000-0000-0000-0000-%'
      )
  and status in ('pending', 'approved');
