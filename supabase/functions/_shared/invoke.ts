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
