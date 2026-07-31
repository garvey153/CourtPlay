-- ============================================================
-- Give the scheduled jobs a durable record of what they did.
--
-- Two layers already report on cron and neither survives long enough to be
-- useful:
--
--   * cron.job_run_details.status says whether net.http_post *executed*, not
--     what came back. It read 'succeeded' for a solid day while every call was
--     being rejected 401.
--   * net._http_response has the actual reply, but pg_net prunes it on a TTL of
--     roughly six hours. game-reminders runs daily at 09:00, so by the time
--     anyone looks the evidence is gone — the health check could only ever
--     report 'stale — response purged' for it.
--
-- So the functions record their own outcome here instead. This table is ours,
-- nothing prunes it, and a row means the function actually reached the end of
-- its work rather than merely that a request was dispatched.
--
-- Only authenticated runs are logged: the write happens after the service-role
-- gate, so a stranger POSTing the public function URL cannot fill this table.
-- That does mean a broken CRON_SECRET produces no row at all — which is the
-- point. Absence past the expected schedule is the signal that auth has broken,
-- and the health check reads it that way.
-- ============================================================

create table if not exists public.cron_run_log (
    id       bigint generated always as identity primary key,
    job_name text        not null,
    fn_build text,
    ok       boolean     not null,
    -- The function's own response body: counts, dispatch tallies, failures.
    detail   jsonb,
    -- Populated when ok is false, so a failure explains itself without the body.
    error    text,
    ran_at   timestamptz not null default now()
);

-- The health check only ever asks for the latest run per job.
create index if not exists cron_run_log_job_ran_at_idx
    on public.cron_run_log (job_name, ran_at desc);

-- Operational data, not app data. The service role bypasses RLS, so enabling it
-- with no policies leaves the functions able to write while anon and
-- authenticated can read nothing. Both grants are revoked as well: Supabase
-- grants anon directly, so RLS alone is not the whole story.
alter table public.cron_run_log enable row level security;

revoke all on public.cron_run_log from anon, authenticated;

comment on table public.cron_run_log is
    'What each scheduled job did on its last run. Written by the edge functions '
    'themselves after the service-role gate, because cron.job_run_details only '
    'reports dispatch and net._http_response is pruned after ~6 hours.';
