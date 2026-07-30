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

serve(async (req) => {
    // A POST to this endpoint runs the job, so the gate has to mean something.
    const denied = requireServiceRole(req, FN_BUILD);
    if (denied) return denied;

    // Calculate tomorrow's date range
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Find active posts with game date = tomorrow
    const { data: posts, error: queryError } = await supabase
        .from("posts")
        .select(`
            id, author_id, game_date, game_time, location, custom_court,
            claims!left(id, claimer_id, status)
        `)
        .eq("status", "active")
        .eq("game_date", tomorrowStr);

    if (queryError) {
        return new Response(JSON.stringify({ error: queryError.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!posts || posts.length === 0) {
        return new Response(JSON.stringify({ fnBuild: FN_BUILD, reminded: 0 }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    const tally = new DispatchTally();

    for (const post of posts) {
        const locationDisplay = post.location ?? post.custom_court ?? "";
        const timeDisplay = post.game_time ? post.game_time.slice(0, 5) : "";

        // Recipients: poster + all approved claimers
        const recipientIds = [post.author_id];
        const claims = (post.claims ?? []) as Array<{ id: string; claimer_id: string; status: string }>;
        for (const claim of claims) {
            if (claim.status === "approved") {
                recipientIds.push(claim.claimer_id);
            }
        }

        for (const userId of recipientIds) {
            // Deduplication
            if (await alreadyNotified(supabase, { userId: userId, type: "game_reminder", postId: post.id })) continue;

            const res = await invokeFunction("send-notification", {
                user_id: userId,
                notification_type: "game_reminder",
                post_id: post.id,
                data: {
                    game_date: post.game_date,
                    game_time: timeDisplay,
                    location: locationDisplay,
                },
            });

            tally.record(res, { user_id: userId, post_id: post.id });
        }
    }

    return new Response(JSON.stringify({ fnBuild: FN_BUILD, ...tally.toResponse("reminded") }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
