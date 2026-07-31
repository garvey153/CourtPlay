import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/service-auth.ts";
import { withCronLog } from "../_shared/cron-log.ts";
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
const FN_BUILD = "2026-07-31a";

interface UnfilledPost {
    id: string;
    author_id: string;
    location: string | null;
    custom_court: string | null;
    game_date: string;
    spots_total: number;
    approved_count: number;
}

serve(async (req) => {
    // A POST to this endpoint runs the job, so the gate has to mean something.
    const denied = requireServiceRole(req, FN_BUILD);
    if (denied) return denied;

    return withCronLog(supabase, "unfilled-nudge-48h", FN_BUILD, async () => {

        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        // Find active sub_need posts created > 48h ago with open spots and game still upcoming
        const { data: posts, error: queryError } = await supabase
            .from("posts")
            .select(`
                id, author_id, location, custom_court, game_date, spots_total,
                claims!left(id, status)
            `)
            .eq("status", "active")
            .eq("post_type", "sub_need")
            .lt("created_at", fortyEightHoursAgo)
            .gt("game_date", new Date().toISOString().slice(0, 10));

        if (queryError) {
            return new Response(JSON.stringify({ error: queryError.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!posts || posts.length === 0) {
            return new Response(JSON.stringify({ fnBuild: FN_BUILD, nudged: 0 }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const tally = new DispatchTally();

        for (const post of posts) {
            // Count approved claims
            const claims = (post.claims ?? []) as Array<{ id: string; status: string }>;
            const approvedCount = claims.filter((c) => c.status === "approved").length;

            // Skip if all spots are filled
            if (approvedCount >= post.spots_total) continue;

            // Deduplication: check if already nudged for this post
            if (await alreadyNotified(supabase, { userId: post.author_id, type: "48h_unfilled", postId: post.id })) continue;

            const postSummary = (post as UnfilledPost).location ?? (post as UnfilledPost).custom_court ?? "your post";

            const res = await invokeFunction("send-notification", {
                user_id: post.author_id,
                notification_type: "48h_unfilled",
                post_id: post.id,
                data: { post_summary: postSummary },
            });

            tally.record(res, { user_id: post.author_id, post_id: post.id });
        }

        return new Response(JSON.stringify({ fnBuild: FN_BUILD, ...tally.toResponse("nudged") }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    });
});
