-- ============================================================================
-- Did the scheduled jobs run, and did the functions accept them?
--
-- Not a migration. Paste into the Supabase SQL editor. Read-only, one result set
-- (the editor only shows the last query's output).
--
-- Why this file exists: cron.job_run_details.status reports whether
-- net.http_post *executed*, not what came back. It said 'succeeded' for a solid
-- day while every call was being rejected 401. The reply lives in
-- net._http_response, and nothing was reading it.
--
-- Read the verdict column. Anything other than 'ok' or 'no run yet' wants
-- attention:
--
--   401 / 403        auth broken — check CRON_SECRET matches between
--                    `supabase secrets list` and vault.decrypted_secrets
--   timed out        pg_net gave up; the function probably still ran, but the
--                    result is lost. Raise timeout_milliseconds in the job.
--   5xx              the function itself errored — read the body
--   no response row  the request never got a reply at all
--
-- 'stale — response purged' is NOT a problem. pg_net prunes net._http_response
-- on a TTL of roughly six hours, so any run older than that has no reply left to
-- read — the row was deleted, not missing. Without this distinction the daily
-- 09:00 game-reminders job reported 'NO RESPONSE ROW' every time the check ran
-- after ~15:00 UTC, which reads identically to a job that never got a reply.
-- To get a real verdict for a daily job, run this within a few hours of its
-- fire time. For history that outlives the TTL, the functions would have to
-- record their own outcomes.
--
-- fnBuild in the body identifies which deploy produced the run.
--
-- CAVEAT: 'no run yet' can also mean 'no run since the job was last
-- re-registered'. cron.unschedule + cron.schedule assigns a NEW jobid, and
-- job_run_details rows from the previous registration no longer join. So after
-- re-running register_cron_jobs.sql, expect a clean slate until each job's next
-- scheduled fire.
-- ============================================================================

with retention as (
    -- The oldest reply pg_net still holds. Anything that ran before this point
    -- cannot have a response row, so a missing one tells us nothing. Derived
    -- from the data rather than hardcoded, since the TTL is not ours to set;
    -- the fallback only matters when the table has been fully pruned.
    select coalesce(min(created), now() - interval '6 hours') as oldest_kept
    from net._http_response
),
recent as (
    select
        j.jobname,
        j.schedule,
        d.status        as cron_status,
        d.start_time,
        r.status_code,
        r.timed_out,
        coalesce(r.content, r.error_msg) as body,
        row_number() over (partition by j.jobname order by d.start_time desc) as rn
    from cron.job j
    left join cron.job_run_details d on d.jobid = j.jobid
    -- pg_net writes the reply moments after the job starts; match on that window
    left join lateral (
        select * from net._http_response nr
        where nr.created between d.start_time - interval '5 seconds'
                             and d.start_time + interval '2 minutes'
        order by nr.created limit 1
    ) r on true
    where j.jobname in (
        'game-reminders', 'unfilled-nudge-48h',
        'friend-expiry-alerts', 'nudge-unresponded-claims',
        'expire-regular-game-posts', 'auto-expire-posts'
    )
)
select
    jobname,
    schedule,
    start_time                                   as last_run,
    cron_status,
    status_code,
    case
        when start_time is null                  then 'no run yet'
        -- the two pure-SQL jobs make no HTTP call, so no response is expected
        when jobname in ('auto-expire-posts', 'expire-regular-game-posts')
             then case when cron_status = 'succeeded' then 'ok' else 'CRON FAILED' end
        when timed_out                           then 'TIMED OUT — result lost'
        -- Ordered before the missing-row case: a purged reply is expected, not a
        -- failure, and only a run inside the retention window can prove anything.
        when status_code is null
             and start_time < (select oldest_kept from retention)
                                                 then 'stale — response purged'
        when status_code is null                 then 'NO RESPONSE ROW'
        when status_code between 200 and 299     then 'ok'
        when status_code in (401, 403)           then 'AUTH REJECTED'
        else                                          'HTTP ' || status_code
    end                                          as verdict,
    left(body, 160)                              as response
from recent
where rn = 1
-- Anything needing attention first, then the merely uninformative, then the ok.
order by
    case
        when start_time is null                                              then 2
        when jobname in ('auto-expire-posts', 'expire-regular-game-posts')
             then case when cron_status = 'succeeded' then 3 else 0 end
        when timed_out                                                       then 0
        when status_code is null
             and start_time < (select oldest_kept from retention)            then 1
        when status_code between 200 and 299                                 then 3
        else                                                                      0
    end,
    jobname;
