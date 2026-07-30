import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/service-auth.ts";
import { DispatchTally, invokeFunction } from "../_shared/invoke.ts";
import { alreadyNotified } from "../_shared/notification-dedupe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Bump on every deploy. Edge functions have no equivalent of the frontend's
 * __BUILD_ID__, so without this there is no way to tell a stale deploy from a
 * genuine failure — which already cost one wrong diagnosis in this project.
 * Echoed on the 401 as well as the success response, because a caller without
 * the service role key can only ever see the 401.
 */
const FN_BUILD = "2026-07-30a";

interface PendingClaim {
    id: string;
    post_id: string;
    claimer_id: string;
    created_at: string;
    posts: { author_id: string; status: string; location: string | null; custom_court: string | null };
}

serve(async (req) => {
    // A POST to this endpoint runs the job, so the gate has to mean something.
    const denied = requireServiceRole(req, FN_BUILD);
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
        return new Response(JSON.stringify({ fnBuild: FN_BUILD, nudged: 0 }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    const tally = new DispatchTally();
    let nudged = 0;

    for (const claim of claims as unknown as PendingClaim[]) {
        const posterId = claim.posts.author_id;
        const postSummary = claim.posts.location ?? claim.posts.custom_court ?? "";

        // Dedupe per recipient, not per claim. This used to check the poster's
        // row alone and `continue` on it, so if the poster's send succeeded and
        // the claimer's failed, every later run saw the poster row and skipped
        // the claim entirely — the claimer was never retried.
        let posterOk = false;
        let claimerOk = false;

        for (const target of [
            { role: "poster", userId: posterId },
            { role: "claimer", userId: claim.claimer_id },
        ]) {
            if (await alreadyNotified(supabase, {
                userId: target.userId,
                type: "nudge_no_response",
                claimId: claim.id,
            })) continue;

            const res = await invokeFunction("send-notification", {
                user_id: target.userId,
                notification_type: "nudge_no_response",
                post_id: claim.post_id,
                claim_id: claim.id,
                data: { post_summary: postSummary },
            });

            const ok = tally.record(res, { claim_id: claim.id, role: target.role, user_id: target.userId });
            if (target.role === "poster") posterOk = ok;
            else claimerOk = ok;
        }

        // This job dispatches twice per claim, so the tally's count is dispatches
        // while `nudged` stays what it always meant — claims acted on.
        if (posterOk || claimerOk) nudged++;
    }

    return new Response(JSON.stringify({ fnBuild: FN_BUILD, nudged, ...tally.toResponse("dispatched") }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
