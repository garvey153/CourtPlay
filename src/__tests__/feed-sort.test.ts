import { describe, expect, it } from "vitest";
import type { FeedPost } from "@/types/feed";

// ---------------------------------------------------------------------------
// Pure sort + filter helpers (mirrors the logic in feed.tsx / get_feed RPC)
// We test the client-side shape of data as returned by the RPC.
// ---------------------------------------------------------------------------

function sortPosts(posts: FeedPost[]): FeedPost[] {
    return [...posts].sort((a, b) => {
        // game_date: nulls last
        if (a.game_date && !b.game_date) return -1;
        if (!a.game_date && b.game_date) return 1;
        if (a.game_date && b.game_date) {
            const dateDiff = a.game_date.localeCompare(b.game_date);
            if (dateDiff !== 0) return dateDiff;
        }
        // Within same date: friends first
        if (a.is_friend !== b.is_friend) return a.is_friend ? -1 : 1;
        // Fallback: most recent first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

function filterActivePosts(posts: FeedPost[]): FeedPost[] {
    const now = new Date();
    return posts.filter((p) => {
        if (p.status !== "active") return false;
        if (p.expires_at && new Date(p.expires_at) <= now) return false;
        return true;
    });
}

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: crypto.randomUUID(),
        author_id: "user-1",
        author_type: "player",
        post_type: "sub_need",
        status: "active",
        format: "point_play",
        total_players: 4,
        game_date: "2026-04-15",
        game_time: "09:00",
        skill_level: "4.0",
        location: "Longshore Club",
        court_id: "court-1",
        custom_court: null,
        pro_name: null,
        cost: 25,
        original_cost: null,
        spots_total: 1,
        spots_available: 1,
        view_count: 0,
        notes: null,
        series_id: null,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Test",
        last_name: "User",
        photo_url: null,
        is_friend: false,
        ...overrides,
    };
}

describe("feed sort order", () => {
    it("sub_need posts sort by soonest game_date first", () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const toISO = (d: Date) => d.toISOString().slice(0, 10);

        const postTomorrow = makePost({ id: "p1", game_date: toISO(tomorrow) });
        const postToday = makePost({ id: "p2", game_date: toISO(today) });
        const postNextWeek = makePost({ id: "p3", game_date: toISO(nextWeek) });

        const sorted = sortPosts([postTomorrow, postToday, postNextWeek]);
        expect(sorted[0].id).toBe("p2"); // today
        expect(sorted[1].id).toBe("p1"); // tomorrow
        expect(sorted[2].id).toBe("p3"); // next week
    });

    it("friend posts sort before non-friend posts within the same date", () => {
        const friend = makePost({ id: "friend", game_date: "2026-05-01", is_friend: true });
        const nonFriend = makePost({ id: "nonfriend", game_date: "2026-05-01", is_friend: false });

        const sorted = sortPosts([nonFriend, friend]);
        expect(sorted[0].id).toBe("friend");
        expect(sorted[1].id).toBe("nonfriend");
    });

    it("regular_game posts (game_date = null) sort after all sub_need posts", () => {
        const sub1 = makePost({ id: "sub1", post_type: "sub_need", game_date: "2026-05-10" });
        const sub2 = makePost({ id: "sub2", post_type: "sub_need", game_date: "2026-06-01" });
        const regular = makePost({ id: "reg", post_type: "regular_game", game_date: null });

        const sorted = sortPosts([regular, sub2, sub1]);
        expect(sorted[0].id).toBe("sub1");
        expect(sorted[1].id).toBe("sub2");
        expect(sorted[2].id).toBe("reg");
    });

    it("within regular_game posts, friend posts sort first", () => {
        const regNonFriend = makePost({
            id: "reg-nf",
            post_type: "regular_game",
            game_date: null,
            is_friend: false,
        });
        const regFriend = makePost({
            id: "reg-f",
            post_type: "regular_game",
            game_date: null,
            is_friend: true,
        });

        const sorted = sortPosts([regNonFriend, regFriend]);
        expect(sorted[0].id).toBe("reg-f");
        expect(sorted[1].id).toBe("reg-nf");
    });
});

describe("feed active filter", () => {
    it("expired posts are excluded from feed", () => {
        const active = makePost({ id: "active", status: "active" });
        const expired = makePost({ id: "expired", status: "expired" });

        const result = filterActivePosts([active, expired]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("active");
    });

    it("posts past their expires_at are excluded", () => {
        const past = new Date(Date.now() - 60000).toISOString();
        const postWithPastExpiry = makePost({ id: "past", expires_at: past });
        const activePost = makePost({ id: "active", expires_at: null });

        const result = filterActivePosts([postWithPastExpiry, activePost]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("active");
    });
});
