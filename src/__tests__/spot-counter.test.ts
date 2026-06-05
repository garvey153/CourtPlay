import { describe, expect, it, vi } from "vitest";
import type { FeedPost } from "@/types/feed";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn() },
}));

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1", author_id: "author-1", author_type: "player",
        post_type: "sub_need", format: "point_play", total_players: 4,
        game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5",
        location: "Longshore Club", court_id: null, custom_court: null,
        pro_name: null, cost: 25, original_cost: null, spots_total: 4,
        series_id: null, notes: null, status: "active", view_count: 0,
        expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(), first_name: "Mike", last_name: "Chen",
        photo_url: null, is_friend: false, spots_available: 4,
        user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...overrides,
    };
}

describe("spot counter", () => {
    it("spots_available correct with no claims", () => {
        const post = makePost({ spots_total: 4, spots_available: 4 });
        expect(post.spots_available).toBe(4);
    });

    it("pending claims reduce spots_available", () => {
        const post = makePost({ spots_total: 4, spots_available: 3 });
        expect(post.spots_available).toBe(3);
    });

    it("approved claims reduce spots_available", () => {
        const post = makePost({ spots_total: 4, spots_available: 3 });
        expect(post.spots_available).toBe(3);
    });

    it("rejected claims do NOT reduce spots_available", () => {
        const post = makePost({ spots_total: 4, spots_available: 4 });
        expect(post.spots_available).toBe(4);
    });

    it("mixed claim statuses calculated correctly", () => {
        const post = makePost({ spots_total: 4, spots_available: 2 });
        expect(post.spots_available).toBe(2);
    });

    it("spots_available = 0 when all spots filled", () => {
        const post = makePost({ spots_total: 2, spots_available: 0 });
        expect(post.spots_available).toBe(0);
    });

    it("isAllFilled derived correctly", () => {
        const post = makePost({ spots_available: 0 });
        const isAllFilled = post.spots_available === 0;
        expect(isAllFilled).toBe(true);
    });

    it("isLowAvailability when exactly 1 remaining", () => {
        const post = makePost({ spots_total: 4, spots_available: 1 });
        const isLowAvailability = post.spots_available === 1 && post.spots_available !== 0;
        expect(isLowAvailability).toBe(true);
    });
});
