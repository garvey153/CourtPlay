-- ============================================================================
-- Which public functions can anon still execute?
--
-- Not a migration. Paste into the Supabase SQL editor and run. Read-only.
--
-- Expect exactly two rows marked "anon: YES", both intentional:
--   get_post_by_id  — /post/:id is a public route, shared links must open for
--                     signed-out visitors. Exposes no email/phone/venmo.
--   is_admin_user   — evaluated during RLS policy checks including anonymous
--                     ones; returns false when auth.uid() is null.
--
-- Anything else marked YES is a function that skipped
-- 20260730000000_revoke_anon_execute_on_rpcs — most likely added after it, since
-- Supabase default-grants EXECUTE to PUBLIC. Re-running that migration fixes it.
-- ============================================================================

select
    p.proname                                                as function,
    pg_get_function_identity_arguments(p.oid)                as args,
    case when has_function_privilege('anon', p.oid, 'EXECUTE')
         then 'anon: YES' else 'anon: no' end                as anon_execute,
    case when has_function_privilege('authenticated', p.oid, 'EXECUTE')
         then 'authed: yes' else 'authed: NO' end            as authed_execute,
    p.prosecdef                                              as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and not exists (
      select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
  )
order by
    -- anon-callable first, so problems surface at the top rather than buried
    has_function_privilege('anon', p.oid, 'EXECUTE') desc,
    p.proname;
