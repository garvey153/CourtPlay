/**
 * Service-role gate for functions that are never called from a browser.
 *
 * The scheduled jobs each authenticated with `if (!token) return 401`, which
 * passes any non-empty bearer token — including the publishable key that ships
 * in the JS bundle. Since a POST to one of these endpoints *runs the job*, that
 * let anyone hold the trigger: fire game-reminders at will, or push every
 * pending nudge out early. There is no browser caller to accommodate, so the
 * check can simply be "are you the service role".
 *
 * pg_cron invokes these with `Authorization: Bearer <service_role_key>`, which
 * is exactly what this accepts.
 */

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Constant-time compare, so a caller can't recover the key by measuring how
 * long the rejection took.
 */
function secretEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/**
 * Returns a 401 Response if the caller isn't the service role, or null to
 * proceed. Callers should `const denied = requireServiceRole(req); if (denied) return denied;`
 */
export function requireServiceRole(req: Request): Response | null {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");

    if (!SUPABASE_SERVICE_ROLE_KEY || !token || !secretEquals(token, SUPABASE_SERVICE_ROLE_KEY)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    return null;
}
