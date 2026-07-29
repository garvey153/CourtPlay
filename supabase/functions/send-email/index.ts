import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "CourtPlay <noreply@courtplay.app>";

serve(async (req) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Validate Authorization — only service role key or internal Edge Function calls allowed
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
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
