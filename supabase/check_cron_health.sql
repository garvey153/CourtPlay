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
-- fnBuild in the body identifies which deploy produced the run.
--
-- CAVEAT: 'no run yet' can also mean 'no run since the job was last
-- re-registered'. cron.unschedule + cron.schedule assigns a NEW jobid, and
-- job_run_details rows from the previous registration no longer join. So after
-- re-running register_cron_jobs.sql, expect a clean slate until each job's next
-- scheduled fire.
-- ============================================================================

with recent as (
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
        when status_code is null                 then 'NO RESPONSE ROW'
        when status_code between 200 and 299     then 'ok'
        when status_code in (401, 403)           then 'AUTH REJECTED'
        else                                          'HTTP ' || status_code
    end                                          as verdict,
    left(body, 160)                              as response
from recent
where rn = 1
order by
    case when start_time is null then 1 else 0 end,
    jobname;
