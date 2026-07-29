import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fans out a feedback_submitted notification (push + email) to every admin.
// Called by the player's client right after submitting feedback; the client
// can't discover admin user IDs itself, so this runs with the service role.
serve(async (req) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Any authenticated caller may submit feedback (verify_jwt gates this).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
        return corsJson({ error: "Unauthorized" }, 401);
    }

    const { feedback_id } = await req.json();
    if (!feedback_id) {
        return corsJson({ error: "Missing feedback_id" }, 400);
    }

    // Look up the feedback and submitter (service role — bypasses RLS).
    const { data: fb } = await supabase
        .from("feedback")
        .select("id, title, user_id, users:user_id(first_name)")
        .eq("id", feedback_id)
        .single();

    if (!fb) {
        return corsJson({ error: "Feedback not found" }, 404);
    }

    const submitterName = (fb.users as { first_name: string | null } | null)?.first_name ?? "";

    // Every admin gets notified.
    const { data: admins } = await supabase.from("users").select("id").eq("is_admin", true);

    // Report what each fan-out actually did. This previously returned a bare
    // count incremented regardless of outcome, so a chain that dispatched
    // nothing at all was indistinguishable from one that worked.
    const results: Array<Record<string, unknown>> = [];
    for (const admin of admins ?? []) {
        const { data, error } = await supabase.functions.invoke("send-notification", {
            body: {
                user_id: admin.id,
                notification_type: "feedback_submitted",
                data: {
                    submitter_name: submitterName,
                    feedback_title: fb.title ?? "",
                },
            },
        });
        results.push({ admin: admin.id, error: error?.message ?? null, response: data ?? null });
    }

    return corsJson({ admins: admins?.length ?? 0, results }, 200);
});
