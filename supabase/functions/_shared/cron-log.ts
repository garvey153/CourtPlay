import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Records what a scheduled job actually did, into public.cron_run_log.
 *
 * The two existing signals both fail for a daily job: cron.job_run_details only
 * reports that net.http_post was dispatched, and net._http_response is pruned
 * after roughly six hours. This writes a row the function owns, so the health
 * check can still answer "did last night's run work?" the next morning.
 *
 * Wraps the handler rather than being called at each `return`, because these
 * functions exit from three or four places each — an early query error, an empty
 * result, the success path — and a logging call bolted onto each one is a
 * logging call waiting to be forgotten when a fifth is added.
 *
 * Call it INSIDE the service-role gate. Logging unauthenticated hits would let
 * anyone POSTing the public URL fill the table, and a broken CRON_SECRET is
 * better detected as "no row at all since the job was due" than as a row saying
 * a stranger was refused.
 */
export async function withCronLog(
    supabase: SupabaseClient,
    jobName: string,
    fnBuild: string,
    run: () => Promise<Response>,
): Promise<Response> {
    let res: Response;

    try {
        res = await run();
    } catch (e) {
        // An unhandled throw is exactly the case the old signals hid: pg_net
        // reports a dispatch, the platform returns 500, and nothing says why.
        await record(supabase, jobName, fnBuild, false, null, errorText(e));
        return new Response(JSON.stringify({ fnBuild, error: "Unhandled error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Read from a clone so the response handed back is still unconsumed.
    let detail: unknown = null;
    try {
        detail = await res.clone().json();
    } catch {
        // Non-JSON body — the status alone still tells us whether it worked.
    }

    await record(supabase, jobName, fnBuild, res.ok, detail, res.ok ? null : bodyError(detail, res.status));
    return res;
}

function errorText(e: unknown): string {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

function bodyError(detail: unknown, status: number): string {
    if (detail && typeof detail === "object" && "error" in detail) {
        const msg = (detail as { error?: unknown }).error;
        if (typeof msg === "string" && msg) return msg;
    }
    return `HTTP ${status}`;
}

/** Never throws: a job that did its work must not fail because logging did. */
async function record(
    supabase: SupabaseClient,
    job_name: string,
    fn_build: string,
    ok: boolean,
    detail: unknown,
    error: string | null,
): Promise<void> {
    try {
        const { error: insertError } = await supabase
            .from("cron_run_log")
            .insert({ job_name, fn_build, ok, detail, error });

        if (insertError) console.error(`cron_run_log insert failed for ${job_name}:`, insertError);
    } catch (e) {
        console.error(`cron_run_log insert threw for ${job_name}:`, e);
    }
}
