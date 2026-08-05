-- ============================================================
-- Drop the first groups schema.
--
-- 20260803000000_groups.sql was pushed to production while its PR was still
-- open, so these tables and functions have been live — with zero rows — and
-- unreferenced by any merged code. The groups model has since changed
-- materially: the creator is the only person who can change membership, there
-- is no invite/accept step, no per-member messaging, and a group is deleted
-- when its last member leaves rather than handed to an heir.
--
-- Evolving the old schema would carry the invite and ownership design forward
-- into a model that has neither, so it is dropped and rebuilt instead. Nothing
-- is lost: both tables are empty.
--
-- Verified empty before writing this — 0 rows in each.
--
-- Order matters. The tables go FIRST: both RLS policies call has_group_access,
-- and Postgres records that as a real dependency, so dropping the function
-- first fails with 2BP01. Dropping a table takes its policies with it, which
-- clears the dependency. The functions are then dropped explicitly — they are
-- not owned by the tables, so `cascade` would have left all nine behind.
--
-- Function bodies are not dependency-tracked (these are string-literal bodies,
-- not BEGIN ATOMIC), so the RPCs referencing the tables drop cleanly afterwards.
-- ============================================================

-- group_members first: it has a FK to groups.
drop table if exists public.group_members;
drop table if exists public.groups;

drop function if exists public.get_group(uuid);
drop function if exists public.get_my_groups();
drop function if exists public.remove_group_member(uuid, uuid);
drop function if exists public.leave_group(uuid);
drop function if exists public.respond_to_group_invite(uuid, boolean);
drop function if exists public.invite_to_group(uuid, uuid);
drop function if exists public.create_group(text);
drop function if exists public.has_group_access(uuid, uuid);
drop function if exists public.is_group_member(uuid, uuid);
