/**
 * Service-role authentication for edge functions.
 *
 * Two shapes are needed, which is why this exports a primitive rather than only
 * the convenience wrapper:
 *
 *   * The scheduled jobs and send-email reject any caller that isn't the service
 *     role outright — `requireServiceRole` / `isServiceRoleToken`.
 *   * send-notification *branches* on it: service role takes the trusted path
 *     with an explicit payload, anything else is a user whose entitlement gets
 *     checked. It needs the boolean, and it needs the token afterwards for
 *     `auth.getUser`.
 *
 * The comparison lived in three places before this — here plus inline copies in
 * send-notification and send-email — which is two too many for a security check.
 */

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Shared secret pg_cron authenticates with.
 *
 * The scheduled jobs used to send the service_role JWT from the dashboard, and
 * every run came back 401 — because Supabase injects different key material into
 * the function runtime than that page shows. Verified by digest: the stored key
 * hashed to 5ab83586…, SUPABASE_SERVICE_ROLE_KEY to 980032d9…. (The same is true
 * of SUPABASE_ANON_KEY versus the anon key in .env.local.) The jobs fired on
 * schedule for a day and delivered nothing.
 *
 * So cron no longer borrows platform key material. This value is set with
 * `supabase secrets set` and stored in Vault, both sides under our control, and
 * a Supabase-side rotation can't silently break it again.
 */
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

/** The bearer token from the Authorization header, or "" if absent. */
export function bearerToken(req: Request): string {
    return (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
}

/**
 * Is this token the service role key?
 *
 * Constant-time, so a caller can't recover the key by measuring how long the
 * rejection took. Returns false for an empty token or an unset key rather than
 * treating either as a match — a function deployed without the env var must fail
 * closed.
 */
function constantTimeEquals(a: string, b: string): boolean {
    if (!a || !b || a.length !== b.length) return false;

    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export function isServiceRoleToken(token: string): boolean {
    return constantTimeEquals(token, SUPABASE_SERVICE_ROLE_KEY);
}

/** Is this the shared secret the scheduled jobs authenticate with? */
export function isCronSecret(token: string): boolean {
    return constantTimeEquals(token, CRON_SECRET);
}

/**
 * Rejects anything that isn't the service role, for functions with no browser
 * caller at all — the scheduled jobs. Returns a 401 Response to return, or null
 * to proceed:
 *
 *     const denied = requireServiceRole(req);
 *     if (denied) return denied;
 *
 * No CORS headers: nothing in a browser calls these, and pg_cron doesn't care.
 * Functions that *are* browser-reachable should use `isServiceRoleToken` and
 * shape their own response with `corsJson`, so a rejection arrives as a readable
 * 401 rather than an opaque CORS failure.
 */
export function requireServiceRole(req: Request, fnBuild?: string): Response | null {
    const token = bearerToken(req);

    // Either identity is acceptable: the service role for a function-to-function
    // call, or CRON_SECRET for pg_cron. Both are secrets only the server holds.
    if (!isServiceRoleToken(token) && !isCronSecret(token)) {
        // fnBuild rides on the rejection, which is the only response an outside
        // caller can see: these functions answer nothing else without the service
        // role key, so without this there is no way to tell a stale deploy from a
        // healthy one. It is a date string, not a secret, and send-notification
        // already echoes its build the same way.
        return new Response(JSON.stringify({ error: "Unauthorized", ...(fnBuild ? { fnBuild } : {}) }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }
    return null;
}
