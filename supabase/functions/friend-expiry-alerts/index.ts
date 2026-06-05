import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ExpiringPost {
    id: string;
    author_id: string;
}

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
        return new Response(JSON.stringify({ alerted: 0 }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    let alerted = 0;

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
            const { data: existing } = await supabase
                .from("notifications")
                .select("id")
                .eq("user_id", follower_id)
                .eq("type", "friend_expiry")
                .eq("post_id", post.id)
                .maybeSingle();

            if (existing) continue;

            await supabase.functions.invoke("send-notification", {
                body: {
                    user_id: follower_id,
                    notification_type: "friend_expiry",
                    post_id: post.id,
                    data: {
                        poster_name: posterName,
                        location,
                    },
                },
            });

            alerted++;
        }
    }

    return new Response(JSON.stringify({ alerted }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
