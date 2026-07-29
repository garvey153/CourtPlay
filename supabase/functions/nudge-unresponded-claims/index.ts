import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/service-auth.ts";
import { DispatchTally, invokeFunction } from "../_shared/invoke.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface PendingClaim {
    id: string;
    post_id: string;
    claimer_id: string;
    created_at: string;
    posts: { author_id: string; status: string; location: string | null; custom_court: string | null };
}

serve(async (req) => {
    // A POST to this endpoint runs the job, so the gate has to mean something.
    const denied = requireServiceRole(req);
    if (denied) return denied;

    // Find pending claims older than 12 hours on active posts
    const { data: claims, error: queryError } = await supabase
        .from("claims")
        .select("id, post_id, claimer_id, created_at, posts!inner(author_id, status, location, custom_court)")
        .eq("status", "pending")
        .eq("posts.status", "active")
        .lt("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());

    if (queryError) {
        return new Response(JSON.stringify({ error: queryError.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!claims || claims.length === 0) {
        return new Response(JSON.stringify({ nudged: 0 }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    const tally = new DispatchTally();
    let nudged = 0;

    for (const claim of claims as unknown as PendingClaim[]) {
        const posterId = claim.posts.author_id;
        const postSummary = claim.posts.location ?? claim.posts.custom_court ?? "";

        // Check if we already sent a nudge for this claim (to the poster)
        const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", posterId)
            .eq("type", "nudge_no_response")
            .eq("claim_id", claim.id)
            .maybeSingle();

        if (existing) continue; // Already nudged

        // Send nudge to poster
        const posterRes = await invokeFunction("send-notification", {
            user_id: posterId,
            notification_type: "nudge_no_response",
            post_id: claim.post_id,
            claim_id: claim.id,
            data: { post_summary: postSummary },
        });

        // Send nudge to claimer simultaneously
        const claimerRes = await invokeFunction("send-notification", {
            user_id: claim.claimer_id,
            notification_type: "nudge_no_response",
            post_id: claim.post_id,
            claim_id: claim.id,
            data: { post_summary: postSummary },
        });

        const posterOk = tally.record(posterRes, { claim_id: claim.id, role: "poster", user_id: posterId });
        const claimerOk = tally.record(claimerRes, { claim_id: claim.id, role: "claimer", user_id: claim.claimer_id });

        // This job dispatches twice per claim, so the tally's count is dispatches
        // while `nudged` stays what it always meant — claims acted on.
        if (posterOk || claimerOk) nudged++;
    }

    return new Response(JSON.stringify({ nudged, ...tally.toResponse("dispatched") }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
