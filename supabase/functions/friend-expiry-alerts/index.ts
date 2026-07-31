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

interface ExpiringPost {
    id: string;
    author_id: string;
}

serve(async (req) => {
    // A POST to this endpoint runs the job, so the gate has to mean something.
    const denied = requireServiceRole(req, FN_BUILD);
    if (denied) return denied;

    return withCronLog(supabase, "friend-expiry-alerts", FN_BUILD, async () => {

        const now = new Date();
        const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

        // Find active sub_need posts with game within 4 hours that still have open spots
        const { data: posts, error: rpcError } = await supabase.rpc("get_expiring_friend_posts", {
            p_cutoff: fourHoursFromNow.toISOString(),
        });

        if (rpcError) {
            return new Response(JSON.stringify({ error: rpcError.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!posts || (posts as ExpiringPost[]).length === 0) {
            return new Response(JSON.stringify({ fnBuild: FN_BUILD, alerted: 0 }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const tally = new DispatchTally();

        for (const post of posts as ExpiringPost[]) {
            // Get poster info for the notification body
            const { data: posterInfo } = await supabase
                .from("users")
                .select("first_name")
                .eq("id", post.author_id)
                .single();

            // Get post location info
            const { data: postInfo } = await supabase
                .from("posts")
                .select("location, custom_court")
                .eq("id", post.id)
                .single();

            const posterName = posterInfo?.first_name ?? "A friend";
            const location = postInfo?.location ?? postInfo?.custom_court ?? "";

            // Get all followers of this poster
            const { data: followers } = await supabase
                .from("follows")
                .select("follower_id")
                .eq("following_id", post.author_id);

            if (!followers || followers.length === 0) continue;

            for (const { follower_id } of followers) {
                // Exclude the poster themselves (edge case: user follows themselves)
                if (follower_id === post.author_id) continue;

                // Deduplicate — check if we already sent this alert
                if (await alreadyNotified(supabase, { userId: follower_id, type: "friend_expiry", postId: post.id })) continue;

                const res = await invokeFunction("send-notification", {
                    user_id: follower_id,
                    notification_type: "friend_expiry",
                    post_id: post.id,
                    data: {
                        poster_name: posterName,
                        location,
                    },
                });

                tally.record(res, { user_id: follower_id, post_id: post.id });
            }
        }

        return new Response(JSON.stringify({ fnBuild: FN_BUILD, ...tally.toResponse("alerted") }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    });
});
