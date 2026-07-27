import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fans out a feedback_submitted notification (push + email) to every admin.
// Called by the player's client right after submitting feedback; the client
// can't discover admin user IDs itself, so this runs with the service role.
serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    // Any authenticated caller may submit feedback (verify_jwt gates this).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { feedback_id } = await req.json();
    if (!feedback_id) {
        return new Response(JSON.stringify({ error: "Missing feedback_id" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Look up the feedback and submitter (service role — bypasses RLS).
    const { data: fb } = await supabase
        .from("feedback")
        .select("id, title, user_id, users:user_id(first_name)")
        .eq("id", feedback_id)
        .single();

    if (!fb) {
        return new Response(JSON.stringify({ error: "Feedback not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    const submitterName = (fb.users as { first_name: string | null } | null)?.first_name ?? "";

    // Every admin gets notified.
    const { data: admins } = await supabase.from("users").select("id").eq("is_admin", true);

    let notified = 0;
    for (const admin of admins ?? []) {
        await supabase.functions.invoke("send-notification", {
            body: {
                user_id: admin.id,
                notification_type: "feedback_submitted",
                data: {
                    submitter_name: submitterName,
                    feedback_title: fb.title ?? "",
                },
            },
        });
        notified++;
    }

    return new Response(JSON.stringify({ notified }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
