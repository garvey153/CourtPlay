-- ============================================================================
-- Verify the users-table SELECT policy after 20260729000000_restrict_users_select.
--
-- Not a migration. Paste into the Supabase SQL editor and run. Everything happens
-- inside a transaction that ROLLBACKs, so it changes nothing.
--
-- Results print as NOTICE lines. Every line should read PASS. A FAIL on check 1
-- means emails are still exposed; a FAIL on 2, 3 or 4 means the app is broken
-- and you should apply the rollback at the bottom of this file.
--
-- It works by impersonating each role the way PostgREST does — setting `role`
-- and `request.jwt.claims` — so RLS is evaluated exactly as it is for a real
-- request, rather than as the postgres superuser which bypasses RLS entirely.
-- ============================================================================

begin;

do $$
declare
    v_admin   uuid;
    v_plain   uuid;
    v_total   integer;
    v_count   integer;
    v_emails  integer;
    v_ok      boolean;
begin
    -- Pick subjects as postgres, before impersonating anyone.
    select count(*) into v_total from public.users where deleted_at is null;

    select id into v_admin
    from public.users
    where is_admin = true and deleted_at is null
    order by created_at limit 1;

    select id into v_plain
    from public.users
    where coalesce(is_admin, false) = false and deleted_at is null
    order by created_at limit 1;

    if v_admin is null or v_plain is null then
        raise exception 'Need at least one admin and one non-admin user to verify (admin=%, plain=%)', v_admin, v_plain;
    end if;

    raise notice '--- subjects: % total users, admin=%, non-admin=% ---', v_total, v_admin, v_plain;

    -- ── 1. anon must read nothing ───────────────────────────────────────────
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);

    select count(*), count(email) into v_count, v_emails from public.users;
    v_ok := (v_count = 0);
    raise notice '% check 1  anon reads users            rows=% emails=%  (want 0/0)',
        case when v_ok then 'PASS' else 'FAIL' end, v_count, v_emails;

    perform set_config('role', 'postgres', true);

    -- ── 2. a signed-in user reads only their own row ────────────────────────
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_plain, 'role', 'authenticated')::text, true);

    select count(*) into v_count from public.users;
    v_ok := (v_count = 1);
    raise notice '% check 2  non-admin reads users        rows=%  (want exactly 1, their own)',
        case when v_ok then 'PASS' else 'FAIL' end, v_count;

    select count(*) into v_count from public.users where id = v_plain;
    v_ok := (v_count = 1);
    raise notice '% check 3  non-admin reads OWN row      rows=%  (want 1 — login/profile depends on this)',
        case when v_ok then 'PASS' else 'FAIL' end, v_count;

    perform set_config('role', 'postgres', true);

    -- ── 3. admins keep full access ──────────────────────────────────────────
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

    select count(*) into v_count from public.users;
    v_ok := (v_count = v_total);
    raise notice '% check 4  admin reads users           rows=% of %  (want all — admin screens depend on this)',
        case when v_ok then 'PASS' else 'FAIL' end, v_count, v_total;

    perform set_config('role', 'postgres', true);

    -- ── 4. the replacement RPCs still work for a normal user ────────────────
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_plain, 'role', 'authenticated')::text, true);

    begin
        select jsonb_array_length(public.get_suggested_follows(5)) into v_count;
        v_ok := (v_count >= 0);
        raise notice '% check 5  get_suggested_follows       returned % rows',
            case when v_ok then 'PASS' else 'FAIL' end, v_count;
    exception when others then
        raise notice 'FAIL check 5  get_suggested_follows       errored: %', sqlerrm;
    end;

    begin
        select jsonb_array_length(public.search_users('a', 8)) into v_count;
        v_ok := (v_count >= 0);
        raise notice '% check 6  search_users                returned % rows',
            case when v_ok then 'PASS' else 'FAIL' end, v_count;
    exception when others then
        raise notice 'FAIL check 6  search_users                errored: %', sqlerrm;
    end;

    perform set_config('role', 'postgres', true);

    -- ── 5. anon must not be able to call the RPCs at all ────────────────────
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);

    begin
        perform public.search_users('a', 8);
        raise notice 'FAIL check 7  anon calls search_users     succeeded — should be denied';
    exception when others then
        raise notice 'PASS check 7  anon calls search_users     denied (%)', left(sqlerrm, 60);
    end;

    perform set_config('role', 'postgres', true);
    raise notice '--- done. every line above should read PASS ---';
end $$;

rollback;

-- ============================================================================
-- ROLLBACK, if the app breaks. Restores the previous (wide-open) policy exactly
-- as it was, so you are back to a known state rather than a third one.
--
--   drop policy if exists "Users read own row" on public.users;
--   drop policy if exists "Admins full access users v2" on public.users;
--
--   create policy "Public users readable" on public.users
--     for select using (deleted_at is null and is_suspended = false);
--
--   create policy "Admins full access users" on public.users
--     for all using (
--       exists (select 1 from public.users where id = auth.uid() and is_admin = true)
--     );
--
-- Note the app changes in this PR (onboarding using search_users /
-- get_suggested_follows) keep working under the old policy too, so a rollback of
-- the policy alone does not require reverting the frontend.
-- ============================================================================
