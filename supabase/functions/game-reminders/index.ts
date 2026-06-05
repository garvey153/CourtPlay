import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    // Validate Authorization
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

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
        return new Response(JSON.stringify({ reminded: 0 }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    let reminded = 0;

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
            const { data: existing } = await supabase
                .from("notifications")
                .select("id")
                .eq("user_id", userId)
                .eq("type", "game_reminder")
                .eq("post_id", post.id)
                .maybeSingle();

            if (existing) continue;

            await supabase.functions.invoke("send-notification", {
                body: {
                    user_id: userId,
                    notification_type: "game_reminder",
                    post_id: post.id,
                    data: {
                        game_date: post.game_date,
                        game_time: timeDisplay,
                        location: locationDisplay,
                    },
                },
            });

            reminded++;
        }
    }

    return new Response(JSON.stringify({ reminded }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
