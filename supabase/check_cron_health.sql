-- ============================================================================
-- Did the scheduled jobs run, and did they finish their work?
--
-- Not a migration. Read-only, one result set (the SQL editor only shows the last
-- query's output). Run with the CLI as:
--
--     npx supabase db query --linked -f supabase/check_cron_health.sql
--
-- (-f is required: passed inline, the CLI reads this file's leading `--`
-- comments as flags.)
--
-- Why this file exists: cron.job_run_details.status reports whether
-- net.http_post *executed*, not what came back. It said 'succeeded' for a solid
-- day while every call was being rejected 401.
--
-- The reply lives in net._http_response, but pg_net prunes that after roughly
-- six hours — so for game-reminders, which runs daily at 09:00, the evidence was
-- always gone by the time anyone looked. The functions therefore record their
-- own outcome in public.cron_run_log, which nothing prunes. That is the source
-- of truth here; net._http_response is only worth opening for a run inside the
-- last six hours.
--
-- Read the verdict column. Anything other than 'ok' or 'no run yet' wants
-- attention:
--
--   FAILED             the function ran and reported failure — the reason is in
--                      the detail column
--   LAST RUN NOT LOGGED  cron dispatched, but no outcome was recorded for it.
--                      The function never reached the end of its work: almost
--                      always a 401, so check CRON_SECRET matches between
--                      `supabase secrets list` and vault.decrypted_secrets.
--                      Only authenticated runs log, precisely so this shows up.
--   NO OUTCOME LOGGED  same, for a job that has never logged anything. Expect
--                      this for every function job until the deploy that added
--                      logging has been out for one full cycle.
--   CRON FAILED        a pure-SQL job whose statement errored
--
-- fn_build identifies which deploy produced the run.
--
-- CAVEAT: 'no run yet' can also mean 'no run since the job was last
-- re-registered'. cron.unschedule + cron.schedule assigns a NEW jobid, and
-- job_run_details rows from the previous registration no longer join. The log is
-- unaffected — it is keyed by job name, not jobid — so after re-registering,
-- last_logged still shows the last real outcome.
-- ============================================================================

with logged as (
    -- Latest recorded outcome per job. Keyed by name, so it survives
    -- re-registration and pg_net's TTL alike.
    select distinct on (job_name)
        job_name, ran_at, ok, fn_build, error, detail
    from public.cron_run_log
    order by job_name, ran_at desc
),
dispatched as (
    -- Latest dispatch per job, which is all cron itself can tell us.
    select distinct on (j.jobname)
        j.jobname, j.schedule, d.status as cron_status, d.start_time
    from cron.job j
    left join cron.job_run_details d on d.jobid = j.jobid
    where j.jobname in (
        'game-reminders', 'unfilled-nudge-48h',
        'friend-expiry-alerts', 'nudge-unresponded-claims',
        'expire-regular-game-posts', 'auto-expire-posts'
    )
    order by j.jobname, d.start_time desc nulls last
)
select
    r.jobname,
    r.schedule,
    r.start_time                                 as last_dispatch,
    l.ran_at                                     as last_logged,
    l.fn_build,
    case
        -- These two run their statement in the database; there is no function to
        -- report back, so cron's own status is the whole story.
        when r.jobname in ('auto-expire-posts', 'expire-regular-game-posts')
             then case when r.cron_status = 'succeeded' then 'ok' else 'CRON FAILED' end
        when r.start_time is null                then 'no run yet'
        when l.ran_at is null                    then 'NO OUTCOME LOGGED'
        when not l.ok                            then 'FAILED'
        -- A dispatch newer than the newest log row means that run never finished.
        -- The grace period covers the seconds between cron firing and the
        -- function writing its row.
        when r.start_time > l.ran_at + interval '5 minutes'
                                                 then 'LAST RUN NOT LOGGED'
        else                                          'ok'
    end                                          as verdict,
    left(coalesce(l.error, l.detail::text), 160) as detail
from dispatched r
left join logged l on l.job_name = r.jobname
-- Problems first, then the not-yet-known, then ok.
order by
    case
        when r.jobname in ('auto-expire-posts', 'expire-regular-game-posts')
             then case when r.cron_status = 'succeeded' then 3 else 0 end
        when r.start_time is null                                    then 2
        when l.ran_at is null                                        then 1
        when not l.ok                                                then 0
        when r.start_time > l.ran_at + interval '5 minutes'           then 0
        else                                                              3
    end,
    r.jobname;
