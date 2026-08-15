import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";
import { bearerToken, isServiceRoleToken } from "../_shared/service-auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "CourtPlay <noreply@courtplay.app>";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    // corsJson rather than requireServiceRole: this one is reachable from a
    // browser by mistake, and a CORS-less 401 shows up there as an opaque network
    // error instead of the actual complaint.
    if (!isServiceRoleToken(bearerToken(req))) {
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

        // Record what Resend said. "Rejected" and "accepted, then lost to a spam
        // folder" are indistinguishable from outside and need different fixes, so
        // the answer has to be written down somewhere readable.
        await logEmail(to, subject, res.ok, res.status, res.ok ? (data?.id ?? null) : JSON.stringify(data));

        return corsJson(data, res.ok ? 200 : 500);
    } catch (e) {
        await logEmail(to, subject, false, null, String(e));
        return corsJson({ error: String(e) }, 500);
    }
});

/**
 * Best effort by design: a logging failure must never turn a delivered email
 * into a reported one, so everything here is swallowed.
 */
async function logEmail(
    to: string,
    subject: string,
    ok: boolean,
    status: number | null,
    detail: string | null,
): Promise<void> {
    try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/email_log`, {
            method: "POST",
            headers: {
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
            },
            body: JSON.stringify({
                to_email: String(to).slice(0, 320),
                subject: subject ? String(subject).slice(0, 300) : null,
                ok,
                status,
                detail: detail ? detail.slice(0, 2000) : null,
            }),
        });
    } catch {
        // Diagnostics are not worth failing a send over.
    }
}
