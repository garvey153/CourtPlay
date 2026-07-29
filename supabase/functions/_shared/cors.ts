/**
 * Supabase's gateway does NOT answer CORS preflights for edge functions — an
 * OPTIONS request is handed straight to our handler. A function invoked from the
 * browser therefore has to answer the preflight itself and repeat these headers
 * on every real response, or `supabase.functions.invoke` fails in the browser
 * with a bare "Failed to send a request to the Edge Function" and the POST is
 * never actually sent.
 *
 * `*` is safe here: these functions authenticate with the Authorization header,
 * never cookies, so there are no credentials for a hostile origin to ride on.
 */
export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Answers a CORS preflight, or returns null if this isn't one. */
export function handlePreflight(req: Request): Response | null {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    return null;
}

/** JSON response with the CORS headers attached. */
export function corsJson(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
