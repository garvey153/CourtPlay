import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "CourtPlay <noreply@courtplay.app>";

serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    // Validate Authorization — only service role key or internal Edge Function calls allowed
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
        return new Response(JSON.stringify({ error: "Missing to, subject, or html" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
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

        return new Response(JSON.stringify(data), {
            status: res.ok ? 200 : 500,
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
