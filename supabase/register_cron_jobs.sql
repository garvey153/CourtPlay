-- ============================================================================
-- STEP 2 of 2 — register the scheduled jobs.
--
-- Not a migration. Paste into the Supabase SQL editor and run by hand. It is
-- deliberately outside migrations/ because the CLI applies those on every
-- `db reset`, and registering production cron jobs against a local database
-- would fail the Vault guard below for no good reason.
--
-- This is the record of what is actually scheduled. Until 2026-07-29 that
-- record existed nowhere at all: only `auto-expire-posts` was registered, the
-- four notification jobs had never fired in production, and the intended
-- schedules survived solely as commented-out SQL in two migrations that had
-- drifted (wrong slug, literal key). Keeping it here means a schedule can be
-- reviewed and diffed rather than archaeologically recovered from the database.
--
-- Prerequisites:
--   * store_service_key_in_vault.sql has been run (the guard below enforces it)
--   * the four edge functions are deployed
--
-- Contains no secret: each job builds its Authorization header at run time from
-- the Vault secret, so rotating the key needs step 1 only. Safe to re-run —
-- every job is unscheduled first.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Refuse to register anything if the secret isn't there. Without this the jobs
-- register happily and then fail on every run — which is exactly what happened:
-- they authenticated with the dashboard's service_role JWT, which is NOT the key
-- Supabase injects into the function runtime, and pg_cron recorded 'succeeded'
-- for a day of 401s because net.http_post itself worked fine.
do $$
declare
    v_key text;
begin
    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'cron_secret';

    if v_key is null then
        raise exception 'Vault secret "cron_secret" not found. Set it with `supabase secrets set CRON_SECRET=…` and store the same value here first.';
    end if;

    if length(v_key) < 32 then
        raise exception 'cron_secret is only % chars — too short to be the generated value.', length(v_key);
    end if;

    raise notice 'cron_secret present (% chars)', length(v_key);
end $$;

-- Clear any previous registrations. cron.unschedule throws when the job is absent,
-- which is the current state for all five, so each is guarded independently.
do $$
declare
    j text;
begin
    foreach j in array array[
        'unfilled-nudge-48h',
        'game-reminders',
        'friend-expiry-alerts',
        'nudge-unresponded-claims',
        'expire-regular-game-posts'
    ] loop
        begin
            perform cron.unschedule(j);
        exception when others then
            null;
        end;
    end loop;
end $$;

-- N10 — poster nudge on a post still unfilled after 48h (every 6 hours).
-- Note the slug: Supabase requires ^[A-Za-z][A-Za-z0-9_-]*$, so the original
-- 48h-unfilled-nudge could never be deployed and 404'd for months.
select cron.schedule('unfilled-nudge-48h', '0 */6 * * *', $job$
    select net.http_post(
        url := 'https://uheeddmtntnlgrpzfjph.supabase.co/functions/v1/unfilled-nudge-48h',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets
                where name = 'cron_secret'
            ),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        -- pg_net defaults to 5s and gives up waiting, which game-reminders
        -- exceeded on a cold start. The function still runs to completion — only
        -- the reply is lost — so a timed-out row is indistinguishable from a job
        -- that genuinely failed, and net._http_response is the only place these
        -- results are recorded. 30s is comfortably above a cold start.
        timeout_milliseconds := 30000
    );
$job$);

-- N11 — game tomorrow reminder to poster and approved claimers (daily 09:00 UTC).
select cron.schedule('game-reminders', '0 9 * * *', $job$
    select net.http_post(
        url := 'https://uheeddmtntnlgrpzfjph.supabase.co/functions/v1/game-reminders',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets
                where name = 'cron_secret'
            ),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        -- pg_net defaults to 5s and gives up waiting, which game-reminders
        -- exceeded on a cold start. The function still runs to completion — only
        -- the reply is lost — so a timed-out row is indistinguishable from a job
        -- that genuinely failed, and net._http_response is the only place these
        -- results are recorded. 30s is comfortably above a cold start.
        timeout_milliseconds := 30000
    );
$job$);

-- N12 — friend's game starting within 4h still has an open spot (hourly).
select cron.schedule('friend-expiry-alerts', '0 * * * *', $job$
    select net.http_post(
        url := 'https://uheeddmtntnlgrpzfjph.supabase.co/functions/v1/friend-expiry-alerts',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets
                where name = 'cron_secret'
            ),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        -- pg_net defaults to 5s and gives up waiting, which game-reminders
        -- exceeded on a cold start. The function still runs to completion — only
        -- the reply is lost — so a timed-out row is indistinguishable from a job
        -- that genuinely failed, and net._http_response is the only place these
        -- results are recorded. 30s is comfortably above a cold start.
        timeout_milliseconds := 30000
    );
$job$);

-- N6 — claim pending with no response for 12h, nudging both sides (every 4 hours).
select cron.schedule('nudge-unresponded-claims', '0 */4 * * *', $job$
    select net.http_post(
        url := 'https://uheeddmtntnlgrpzfjph.supabase.co/functions/v1/nudge-unresponded-claims',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (
                select decrypted_secret from vault.decrypted_secrets
                where name = 'cron_secret'
            ),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        -- pg_net defaults to 5s and gives up waiting, which game-reminders
        -- exceeded on a cold start. The function still runs to completion — only
        -- the reply is lost — so a timed-out row is indistinguishable from a job
        -- that genuinely failed, and net._http_response is the only place these
        -- results are recorded. 30s is comfortably above a cold start.
        timeout_milliseconds := 30000
    );
$job$);

-- Pure SQL, no key needed. Without this, regular_game posts with a past
-- expires_at stay 'active' forever and keep showing in the feed.
select cron.schedule('expire-regular-game-posts', '0 0 * * *', $job$
    update public.posts
    set status = 'expired'
    where status = 'active'
      and post_type = 'regular_game'
      and expires_at is not null
      and expires_at < now()
$job$);

-- Expect six rows: the five above plus the pre-existing auto-expire-posts.
select jobname, schedule, active from cron.job order by jobname;

-- Should return ZERO rows — proof no literal key landed in a system table.
select jobname from cron.job where command like '%eyJ%';
