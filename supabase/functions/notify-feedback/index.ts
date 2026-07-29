import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";
import { invokeFunction } from "../_shared/invoke.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Bump on every deploy — see the same constant in send-notification for why. */
const FN_BUILD = "2026-07-29b";

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

    // An unparseable body would otherwise throw out of the handler, and the
    // platform's 500 carries no CORS headers — so the browser would report a
    // generic network failure instead of the actual complaint.
    let feedback_id: string | undefined;
    try {
        ({ feedback_id } = await req.json());
    } catch {
        return corsJson({ error: "Body must be JSON", fnBuild: FN_BUILD }, 400);
    }
    if (!feedback_id) {
        return corsJson({ error: "Missing feedback_id", fnBuild: FN_BUILD }, 400);
    }

    // Look up the feedback and submitter (service role — bypasses RLS).
    // Keep the error: a malformed embed or a schema drift fails here and used to
    // be indistinguishable from a genuinely unknown id, since both landed on the
    // same bare 404. That made "bogus id returns 404" a useless liveness check.
    const { data: fb, error: fbError } = await supabase
        .from("feedback")
        .select("id, title, user_id, users:user_id(first_name)")
        .eq("id", feedback_id)
        .single();

    if (fbError || !fb) {
        return corsJson(
            { error: "Feedback not found", fnBuild: FN_BUILD, lookupError: fbError?.message ?? null },
            404,
        );
    }

    const submitterName = (fb.users as { first_name: string | null } | null)?.first_name ?? "";

    // Every admin gets notified.
    const { data: admins, error: adminsError } = await supabase
        .from("users")
        .select("id")
        .eq("is_admin", true);

    if (adminsError) {
        return corsJson({ error: "Admin lookup failed", fnBuild: FN_BUILD, detail: adminsError.message }, 500);
    }

    // No admins is a configuration problem, not a success. Reported as its own
    // shape so it can't be mistaken for a fan-out that ran and delivered.
    if (!admins || admins.length === 0) {
        return corsJson({ error: "No admin users found", fnBuild: FN_BUILD, admins: 0 }, 500);
    }

    // Report what each fan-out actually did. This previously returned a bare
    // count incremented regardless of outcome, so a chain that dispatched
    // nothing at all was indistinguishable from one that worked.
    const results: Array<Record<string, unknown>> = [];
    for (const admin of admins) {
        const res = await invokeFunction("send-notification", {
            user_id: admin.id,
            notification_type: "feedback_submitted",
            data: {
                submitter_name: submitterName,
                feedback_title: fb.title ?? "",
            },
        });

        const body = (res.body ?? {}) as { pushSent?: boolean; emailSent?: boolean; fnBuild?: string };
        results.push({
            admin: admin.id,
            status: res.status,
            pushSent: body.pushSent ?? false,
            emailSent: body.emailSent ?? false,
            calleeBuild: body.fnBuild ?? null,
            response: res.body,
        });
    }

    // A fan-out where nothing was actually delivered is a failure, and saying so
    // in the status is what makes it visible to a fire-and-forget caller.
    const delivered = results.filter((r) => r.pushSent || r.emailSent).length;

    return corsJson(
        { ok: delivered > 0, fnBuild: FN_BUILD, admins: admins.length, delivered, results },
        delivered > 0 ? 200 : 502,
    );
});
