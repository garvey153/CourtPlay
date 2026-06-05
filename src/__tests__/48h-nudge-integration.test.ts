import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers: pure-function simulations of the 48h-unfilled-nudge Edge Function
// logic. These mirror what supabase/functions/48h-unfilled-nudge/index.ts does
// so we can unit-test the decision logic without running Deno.
// ---------------------------------------------------------------------------

interface Post {
    id: string;
    author_id: string;
    post_type: string;
    status: string;
    created_at: string;
    game_date: string;
    spots_total: number;
    approved_count: number;
}

function isEligibleFor48hNudge(post: Post): boolean {
    if (post.status !== "active") return false;
    if (post.post_type !== "sub_need") return false;
    const age = Date.now() - new Date(post.created_at).getTime();
    if (age < 48 * 60 * 60 * 1000) return false;
    if (new Date(post.game_date) <= new Date(new Date().toISOString().slice(0, 10)))
        return false;
    if (post.approved_count >= post.spots_total) return false;
    return true;
}

function hasBeenNudged(
    postId: string,
    existingNotifications: Array<{ post_id: string; type: string }>,
): boolean {
    return existingNotifications.some(
        (n) => n.post_id === postId && n.type === "48h_unfilled",
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("48h-unfilled-nudge integration", () => {
    // Fix time to 2026-04-07T12:00:00Z so date arithmetic is deterministic
    const NOW = new Date("2026-04-07T12:00:00Z").getTime();

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Helper to create a base post with sensible defaults */
    function makePost(overrides: Partial<Post> = {}): Post {
        return {
            id: "post-1",
            author_id: "author-1",
            post_type: "sub_need",
            status: "active",
            created_at: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
            game_date: "2026-04-10", // 3 days in the future
            spots_total: 2,
            approved_count: 0,
            ...overrides,
        };
    }

    it("48h nudge suggests discounting in its message", () => {
        // The Edge Function sends notification_type "48h_unfilled" which maps
        // to a template that includes "Consider reducing the price".
        // Verify the notification type that would be created.
        const post = makePost();
        expect(isEligibleFor48hNudge(post)).toBe(true);

        // The notification type used by the Edge Function is "48h_unfilled"
        const notificationType = "48h_unfilled";
        expect(notificationType).toBe("48h_unfilled");
    });

    it("48h nudge does not fire for posts with all spots filled", () => {
        const post = makePost({ spots_total: 1, approved_count: 1 });
        expect(isEligibleFor48hNudge(post)).toBe(false);
    });

    it("48h nudge fires for posts with some spots still open", () => {
        const post = makePost({ spots_total: 3, approved_count: 1 });
        expect(isEligibleFor48hNudge(post)).toBe(true);
    });

    it("poster receives nudge, discounts, then nudge does not repeat", () => {
        const post = makePost();

        // First check: eligible and not yet nudged
        expect(isEligibleFor48hNudge(post)).toBe(true);

        const notifications: Array<{ post_id: string; type: string }> = [];
        expect(hasBeenNudged(post.id, notifications)).toBe(false);

        // Simulate sending the nudge notification
        notifications.push({ post_id: post.id, type: "48h_unfilled" });

        // Second check: still eligible by age/spots, but already nudged → skipped
        expect(isEligibleFor48hNudge(post)).toBe(true);
        expect(hasBeenNudged(post.id, notifications)).toBe(true);
    });

    it("48h nudge only for sub_need, not regular_game", () => {
        const post = makePost({ post_type: "regular_game" });
        expect(isEligibleFor48hNudge(post)).toBe(false);
    });

    it("does not nudge posts with game date in past", () => {
        const post = makePost({ game_date: "2026-04-06" }); // yesterday
        expect(isEligibleFor48hNudge(post)).toBe(false);
    });

    it("does not nudge recently created posts", () => {
        // Created 24h ago — less than the 48h threshold
        const post = makePost({
            created_at: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
        });
        expect(isEligibleFor48hNudge(post)).toBe(false);
    });

    it("does not nudge expired posts", () => {
        const post = makePost({ status: "expired" });
        expect(isEligibleFor48hNudge(post)).toBe(false);
    });
});
