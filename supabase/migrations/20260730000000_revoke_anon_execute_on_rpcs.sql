-- ============================================================
-- Stop the anon key from calling security-definer RPCs.
--
-- Supabase default-grants EXECUTE on new functions to PUBLIC, which includes
-- anon. Almost no migration in this project revoked it, so the publishable key
-- that ships in the JS bundle could invoke most of the API. Confirmed against
-- production 2026-07-29:
--
--   POST /rest/v1/rpc/get_profile {"p_user_id":"a094469c-…"}
--   → 200  {"first_name":"Christopher","last_name":"Garvey","photo_url":"…",
--           "skill_level":"3.0","active_posts":[…]}
--
-- Restricting public.users in 20260729000000 stopped email/phone/venmo leaking
-- through the table, but these functions are SECURITY DEFINER — they bypass RLS
-- entirely, so that fix did nothing for them. follow_user and unfollow_user
-- additionally *write*, and none of the functions in profile_rpcs check whether
-- auth.uid() is null.
--
-- The fix is EXECUTE privileges rather than auth guards inside 25 function
-- bodies: if anon cannot execute, the function never runs and the missing null-uid
-- check becomes unreachable. Rewriting two dozen bodies to add a guard would be a
-- far larger change with real regression risk, for the same result.
--
-- Written as a loop rather than 25 revoke statements so it cannot miss one, and
-- so functions added later are caught by re-running it.
--
-- Idempotent — safe to re-run.
-- ============================================================

do $$
declare
    r record;
    v_locked  int := 0;
    v_skipped text[] := '{}';
begin
    for r in
        select p.oid::regprocedure as sig, p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prokind = 'f'
          -- Functions owned by an extension (pgcrypto, pg_net, …) are not ours to
          -- re-privilege; changing them can break the extension.
          and not exists (
              select 1 from pg_depend d
              where d.objid = p.oid and d.deptype = 'e'
          )
          and p.proname not in (
              -- Reachable without a session by design: /post/:id is a public route
              -- so shared post links open for signed-out visitors. Returns post
              -- detail plus the author's display name and photo — verified to
              -- expose no email, phone or venmo_handle.
              'get_post_by_id',
              -- Called during RLS policy evaluation, including for anonymous
              -- requests. Without the grant that surfaces as a permission error
              -- instead of a clean "no rows". Returns false when auth.uid() is null.
              'is_admin_user'
          )
    loop
        execute format('revoke all on function %s from public, anon', r.sig);
        execute format('grant execute on function %s to authenticated', r.sig);
        v_locked := v_locked + 1;
    end loop;

    -- Report the whitelist explicitly, so the two open doors are visible in the
    -- migration output rather than implied by absence.
    select array_agg(p.proname order by p.proname) into v_skipped
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in ('get_post_by_id', 'is_admin_user');

    raise notice 'Locked % function(s) to authenticated. Still anon-callable by design: %',
        v_locked, coalesce(array_to_string(v_skipped, ', '), 'none');
end $$;
