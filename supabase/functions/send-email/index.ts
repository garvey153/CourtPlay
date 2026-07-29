import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "CourtPlay <noreply@courtplay.app>";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Constant-time string compare, so a caller can't recover the service role key
 * by measuring how long the rejection took.
 */
function secretEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

serve(async (req) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Service role only. The previous check passed any non-empty Authorization
    // header, so the anon key that ships in the JS bundle was enough to send
    // arbitrary HTML to any address from a domain-verified courtplay.app sender.
    // Nothing user-facing calls this directly any more: the admin moderation
    // notice goes through notify-content-removed, which derives the recipient
    // and owns the copy.
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token || !SUPABASE_SERVICE_ROLE_KEY || !secretEquals(token, SUPABASE_SERVICE_ROLE_KEY)) {
        return corsJson({ error: "Unauthorized" }, 401);
    }

    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
        return corsJson({ error: "Missing to, subject, or html" }, 400);
    }

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
        });

        const data = await res.json();

        return corsJson(data, res.ok ? 200 : 500);
    } catch (e) {
        return corsJson({ error: String(e) }, 500);
    }
});
