import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    // Validate Authorization
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

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
        return new Response(JSON.stringify({ nudged: 0 }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    let nudged = 0;

    for (const post of posts) {
        // Count approved claims
        const claims = (post.claims ?? []) as Array<{ id: string; status: string }>;
        const approvedCount = claims.filter((c) => c.status === "approved").length;

        // Skip if all spots are filled
        if (approvedCount >= post.spots_total) continue;

        // Deduplication: check if already nudged for this post
        const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", post.author_id)
            .eq("type", "48h_unfilled")
            .eq("post_id", post.id)
            .maybeSingle();

        if (existing) continue;

        const postSummary = (post as UnfilledPost).location ?? (post as UnfilledPost).custom_court ?? "your post";

        await supabase.functions.invoke("send-notification", {
            body: {
                user_id: post.author_id,
                notification_type: "48h_unfilled",
                post_id: post.id,
                data: { post_summary: postSummary },
            },
        });

        nudged++;
    }

    return new Response(JSON.stringify({ nudged }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
