/**
 * Function-to-function calls.
 *
 * `supabase.functions.invoke` is the wrong tool for this hop. It reports every
 * failure the same way — it never throws, and it collapses a 401 from the
 * gateway, a 500 from the callee, and a network error into one opaque
 * "Edge Function returned a non-2xx status code" with the response body
 * discarded. Debugging a broken fan-out through that is guesswork, and it
 * already hid a dead email leg behind a hardcoded success.
 *
 * A raw fetch keeps the status and the body, which is all the diagnosis needs.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export interface InvokeResult {
    ok: boolean;
    status: number;
    body: unknown;
}

export async function invokeFunction(name: string, payload: unknown): Promise<InvokeResult> {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
            method: "POST",
            headers: {
                // Both headers: the gateway authenticates on `apikey`, the callee
                // reads `Authorization`. Sending only one gets rejected before the
                // handler ever runs.
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        let body: unknown;
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }

        return { ok: res.ok, status: res.status, body };
    } catch (e) {
        // Network-level failure — no status exists, so say so rather than
        // inventing one that looks like an HTTP response.
        return { ok: false, status: 0, body: { error: String(e) } };
    }
}

/** Cap on failure detail in a response body, so one bad run can't return megabytes. */
const MAX_REPORTED_FAILURES = 10;

/**
 * Running count of a fan-out, for the scheduled jobs.
 *
 * Each of those jobs used to increment its counter immediately after dispatching
 * and discard the result, so `{"reminded": 12}` meant "tried 12 times" — it read
 * identically whether all twelve landed or, as was actually the case, none of
 * them did. Counting only successes is what makes the number worth logging.
 */
export class DispatchTally {
    sent = 0;
    private failures: Array<Record<string, unknown>> = [];
    private dropped = 0;

    /** Records one dispatch. Returns true if it succeeded. */
    record(res: InvokeResult, context: Record<string, unknown>): boolean {
        if (res.ok) {
            this.sent++;
            return true;
        }
        if (this.failures.length < MAX_REPORTED_FAILURES) {
            this.failures.push({ ...context, status: res.status, response: res.body });
        } else {
            this.dropped++;
        }
        return false;
    }

    /**
     * `countKey` keeps each job's existing success field name (reminded/nudged/
     * alerted) so callers and dashboards don't have to change.
     */
    toResponse(countKey: string): Record<string, unknown> {
        return {
            [countKey]: this.sent,
            failed: this.failures.length + this.dropped,
            failures: this.failures,
            // Only present when detail was actually withheld, so its absence
            // means "this list is complete" rather than "nobody checked".
            ...(this.dropped > 0 ? { truncatedFailures: this.dropped } : {}),
        };
    }
}
