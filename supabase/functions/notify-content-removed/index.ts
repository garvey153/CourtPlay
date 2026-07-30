import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";
import { invokeFunction } from "../_shared/invoke.ts";
import { bearerToken } from "../_shared/service-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Bump on every deploy — see the same constant in send-notification for why. */
const FN_BUILD = "2026-07-29a";

/**
 * Sends the "your content was removed" moderation notice.
 *
 * This exists because `send-email` is now service-role only. The admin screen
 * used to build this mail in the browser and hand it to `send-email` — which
 * meant `send-email` had to accept a user token, which meant anyone holding the
 * anon key from the JS bundle could send arbitrary HTML to any address from a
 * domain-verified courtplay.app sender.
 *
 * So the admin no longer supplies a recipient or a body. It names a report; the
 * caller is checked for admin, and the recipient is derived from the report's
 * target here. The copy is fixed and lives server-side.
 *
 * Deliberately bypasses notification preferences: a moderation notice is not
 * something the moderated account opts out of.
 */
serve(async (req) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const token = bearerToken(req);
    if (!token) return corsJson({ error: "Unauthorized", fnBuild: FN_BUILD }, 401);

    const { data: caller } = await supabase.auth.getUser(token);
    if (!caller?.user) return corsJson({ error: "Unauthorized", fnBuild: FN_BUILD }, 401);

    const { data: callerRow } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", caller.user.id)
        .single();
    if (!callerRow?.is_admin) return corsJson({ error: "Admin only", fnBuild: FN_BUILD }, 403);

    let report_id: string | undefined;
    try {
        ({ report_id } = await req.json());
    } catch {
        return corsJson({ error: "Body must be JSON", fnBuild: FN_BUILD }, 400);
    }
    if (!report_id) return corsJson({ error: "Missing report_id", fnBuild: FN_BUILD }, 400);

    const { data: report, error: reportError } = await supabase
        .from("reports")
        .select("id, target_type, target_id")
        .eq("id", report_id)
        .single();

    if (reportError || !report) {
        return corsJson(
            { error: "Report not found", fnBuild: FN_BUILD, lookupError: reportError?.message ?? null },
            404,
        );
    }

    // Resolve the account behind the report: the post's author, or the user itself.
    let targetUserId = report.target_id as string;
    if (report.target_type === "post") {
        const { data: post } = await supabase
            .from("posts")
            .select("author_id")
            .eq("id", report.target_id)
            .single();
        if (!post?.author_id) {
            return corsJson({ error: "Post not found for report", fnBuild: FN_BUILD }, 404);
        }
        targetUserId = post.author_id;
    }

    const { data: targetUser } = await supabase
        .from("users")
        .select("email")
        .eq("id", targetUserId)
        .single();

    if (!targetUser?.email) {
        return corsJson({ error: "No email for target user", fnBuild: FN_BUILD }, 404);
    }

    const targetLabel = report.target_type === "post" ? "post" : "account";
    const emailRes = await invokeFunction("send-email", {
        to: targetUser.email,
        subject: "CourtPlay community guidelines notice",
        html: `<p>Your ${targetLabel} was removed for violating our community guidelines. If you believe this was an error, please contact support.</p>`,
    });

    if (!emailRes.ok) {
        return corsJson(
            { error: "Email dispatch failed", fnBuild: FN_BUILD, status: emailRes.status, response: emailRes.body },
            502,
        );
    }

    return corsJson({ success: true, fnBuild: FN_BUILD, response: emailRes.body }, 200);
});
