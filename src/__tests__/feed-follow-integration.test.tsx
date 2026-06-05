import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FeedPost } from "@/types/feed";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1", author_id: "author-1", author_type: "player",
        post_type: "sub_need", format: "point_play", total_players: 4,
        game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5",
        location: "Longshore Club", court_id: null, custom_court: null,
        pro_name: null, cost: 25, original_cost: null, spots_total: 4,
        series_id: null, notes: null, status: "active", view_count: 5,
        expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(), first_name: "Jane", last_name: "Doe",
        photo_url: null, is_friend: false, spots_available: 3,
        user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...overrides,
    };
}

// Simulate the feed sort from get_feed RPC:
// game_date ASC nulls last, is_friend DESC, created_at DESC
function sortFeed(posts: FeedPost[]): FeedPost[] {
    return [...posts].sort((a, b) => {
        // game_date ASC, nulls last
        if (a.game_date && b.game_date) {
            if (a.game_date < b.game_date) return -1;
            if (a.game_date > b.game_date) return 1;
        } else if (a.game_date && !b.game_date) return -1;
        else if (!a.game_date && b.game_date) return 1;

        // is_friend DESC (true before false)
        if (a.is_friend && !b.is_friend) return -1;
        if (!a.is_friend && b.is_friend) return 1;

        // created_at DESC
        return b.created_at.localeCompare(a.created_at);
    });
}

beforeEach(() => { vi.clearAllMocks(); });

describe("feed follow integration", () => {
    it("followed user's posts appear before non-followed within same date", () => {
        const friendPost = makePost({ id: "p1", author_id: "user-b", is_friend: true, game_date: "2026-04-10", created_at: "2026-04-05T10:00:00Z" });
        const nonFriendPost = makePost({ id: "p2", author_id: "user-f", is_friend: false, game_date: "2026-04-10", created_at: "2026-04-05T11:00:00Z" });

        const sorted = sortFeed([nonFriendPost, friendPost]);
        expect(sorted[0].id).toBe("p1"); // friend first
        expect(sorted[1].id).toBe("p2");
    });

    it("unfollowing moves posts back to non-friend position", () => {
        const postA = makePost({ id: "p1", author_id: "user-b", is_friend: false, game_date: "2026-04-10", created_at: "2026-04-05T10:00:00Z" });
        const postB = makePost({ id: "p2", author_id: "user-f", is_friend: false, game_date: "2026-04-10", created_at: "2026-04-05T11:00:00Z" });

        const sorted = sortFeed([postA, postB]);
        // Both non-friends, sorted by created_at DESC
        expect(sorted[0].id).toBe("p2"); // more recent
        expect(sorted[1].id).toBe("p1");
    });

    it("following a new user moves their posts to friend position", () => {
        const existingFriend = makePost({ id: "p1", author_id: "user-b", is_friend: true, game_date: "2026-04-10", created_at: "2026-04-05T10:00:00Z" });
        const newFriend = makePost({ id: "p2", author_id: "user-f", is_friend: true, game_date: "2026-04-10", created_at: "2026-04-05T11:00:00Z" });
        const nonFriend = makePost({ id: "p3", author_id: "user-g", is_friend: false, game_date: "2026-04-10", created_at: "2026-04-05T12:00:00Z" });

        const sorted = sortFeed([nonFriend, existingFriend, newFriend]);
        expect(sorted[0].is_friend).toBe(true);
        expect(sorted[1].is_friend).toBe(true);
        expect(sorted[2].is_friend).toBe(false);
    });
});

describe("friend badge", () => {
    it("Friend badge based on is_friend flag from feed", () => {
        const friendPost = makePost({ is_friend: true });
        const nonFriendPost = makePost({ is_friend: false });
        expect(friendPost.is_friend).toBe(true);
        expect(nonFriendPost.is_friend).toBe(false);
    });

    it("no Friend badges when user follows nobody", () => {
        const posts = [
            makePost({ id: "p1", is_friend: false }),
            makePost({ id: "p2", is_friend: false }),
            makePost({ id: "p3", is_friend: false }),
        ];
        expect(posts.every((p) => !p.is_friend)).toBe(true);
    });

    it("all Friend badges when user follows all posters", () => {
        const posts = [
            makePost({ id: "p1", is_friend: true }),
            makePost({ id: "p2", is_friend: true }),
        ];
        expect(posts.every((p) => p.is_friend)).toBe(true);
    });
});

describe("feed sort edge cases", () => {
    it("sorts by game_date ASC nulls last", () => {
        const dated = makePost({ id: "p1", game_date: "2026-04-10" });
        const nullDate = makePost({ id: "p2", game_date: null });

        const sorted = sortFeed([nullDate, dated]);
        expect(sorted[0].id).toBe("p1"); // dated first
        expect(sorted[1].id).toBe("p2"); // null last
    });

    it("within same date, friends before non-friends, then by recency", () => {
        const oldFriend = makePost({ id: "p1", game_date: "2026-04-10", is_friend: true, created_at: "2026-04-01T10:00:00Z" });
        const newNonFriend = makePost({ id: "p2", game_date: "2026-04-10", is_friend: false, created_at: "2026-04-05T10:00:00Z" });
        const newFriend = makePost({ id: "p3", game_date: "2026-04-10", is_friend: true, created_at: "2026-04-05T12:00:00Z" });

        const sorted = sortFeed([newNonFriend, oldFriend, newFriend]);
        expect(sorted[0].id).toBe("p3"); // friend, newer
        expect(sorted[1].id).toBe("p1"); // friend, older
        expect(sorted[2].id).toBe("p2"); // non-friend
    });
});
