import { supabase } from "@/lib/supabase";
import { useAuth } from "./use-auth";

export interface SubNeedPostData {
    format: string;
    total_players: number;
    game_date: string;
    game_time: string;
    skill_level: string;
    court_id?: string | null;
    custom_court?: string | null;
    location?: string | null;
    pro_name?: string | null;
    cost: number;
    spots_total?: number;
    notes?: string | null;
    series_id?: string | null;
}

export interface RegularGamePostData {
    format?: string | null;
    total_players?: number | null;
    skill_level: string;
    preferred_days?: string[];
    preferred_times?: string[];
    court_preferences?: string[];
    notes?: string | null;
}

export type Post = Record<string, unknown> & { id: string };

const RATE_LIMIT = 5;

export function usePosts() {
    const { user } = useAuth();

    /** Count how many active posts the user currently has. */
    async function getUserActivePostCount(userId: string): Promise<number> {
        const { data } = await supabase
            .from("posts")
            .select("id")
            .eq("author_id", userId)
            .eq("status", "active");
        return (data ?? []).length;
    }

    /** Return all posts authored by userId, newest first. */
    async function getUserPosts(userId: string): Promise<Post[]> {
        const { data, error } = await supabase
            .from("posts")
            .select("*")
            .eq("author_id", userId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as Post[];
    }

    /** Create a single sub_need post. Enforces the 5-post rate limit. */
    async function createSubNeedPost(data: SubNeedPostData): Promise<Post> {
        if (!user) throw new Error("Not authenticated");

        const count = await getUserActivePostCount(user.id);
        if (count >= RATE_LIMIT) {
            throw new Error(`Rate limit: you already have ${RATE_LIMIT} active posts`);
        }

        const { data: post, error } = await supabase
            .from("posts")
            .insert({
                author_id: user.id,
                post_type: "sub_need",
                status: "active",
                spots_total: data.spots_total ?? 1,
                ...data,
            })
            .select()
            .single();

        if (error) throw error;
        return post as Post;
    }

    /** Create a regular_game post. Automatically sets expires_at to +30 days. */
    async function createRegularGamePost(data: RegularGamePostData): Promise<Post> {
        if (!user) throw new Error("Not authenticated");

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { data: post, error } = await supabase
            .from("posts")
            .insert({
                author_id: user.id,
                post_type: "regular_game",
                status: "active",
                expires_at: expiresAt.toISOString(),
                preferred_days: data.preferred_days ?? [],
                preferred_times: data.preferred_times ?? [],
                court_preferences: data.court_preferences ?? [],
                ...data,
            })
            .select()
            .single();

        if (error) throw error;
        return post as Post;
    }

    /** Insert one post per date, all sharing a freshly generated series_id. */
    async function createSeriesPosts(
        data: Omit<SubNeedPostData, "game_date" | "series_id">,
        dates: string[],
    ): Promise<Post[]> {
        if (!user) throw new Error("Not authenticated");

        const seriesId = crypto.randomUUID();
        const rows = dates.map((date) => ({
            author_id: user.id,
            post_type: "sub_need",
            status: "active",
            spots_total: data.spots_total ?? 1,
            ...data,
            game_date: date,
            series_id: seriesId,
        }));

        const { data: posts, error } = await supabase.from("posts").insert(rows).select();

        if (error) throw error;
        return (posts ?? []) as Post[];
    }

    /** Update a post. Only pass the fields you want to change. */
    async function updatePost(id: string, data: Partial<SubNeedPostData & RegularGamePostData>): Promise<Post> {
        const { data: post, error } = await supabase
            .from("posts")
            .update(data)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return post as Post;
    }

    return {
        createSubNeedPost,
        createRegularGamePost,
        createSeriesPosts,
        updatePost,
        getUserActivePostCount,
        getUserPosts,
    };
}
