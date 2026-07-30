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
export function isServiceRoleToken(token: string): boolean {
    if (!token || !SUPABASE_SERVICE_ROLE_KEY) return false;
    if (token.length !== SUPABASE_SERVICE_ROLE_KEY.length) return false;

    let diff = 0;
    for (let i = 0; i < token.length; i++) {
        diff |= token.charCodeAt(i) ^ SUPABASE_SERVICE_ROLE_KEY.charCodeAt(i);
    }
    return diff === 0;
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
export function requireServiceRole(req: Request): Response | null {
    if (!isServiceRoleToken(bearerToken(req))) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }
    return null;
}
