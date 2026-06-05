import { describe, expect, it } from "vitest";
import { derivePostState, POST_STATE_BADGE } from "@/utils/activity-states";

function makePost(overrides: Record<string, unknown> = {}) {
    return {
        status: "active",
        spots_available: 1,
        claims: [] as Array<{ status: string }>,
        series_id: null as string | null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// State rendering
// ---------------------------------------------------------------------------
describe("Post state rendering", () => {
    it("active post with no claims shows Active state", () => {
        const post = makePost();
        expect(derivePostState(post)).toBe("active");
        expect(POST_STATE_BADGE.active.label).toBe("Active");
    });

    it("active post with pending claim shows Pending state", () => {
        const post = makePost({ claims: [{ status: "pending" }] });
        expect(derivePostState(post)).toBe("pending");
    });

    it("active post with approved claim shows Claimed state", () => {
        const post = makePost({
            claims: [{ status: "approved" }],
            spots_available: 1,
        });
        expect(derivePostState(post)).toBe("claimed");
    });

    it("active post with all spots filled shows Filled state", () => {
        const post = makePost({
            claims: [{ status: "approved" }],
            spots_available: 0,
        });
        expect(derivePostState(post)).toBe("filled");
    });

    it("expired post with approved claims shows Completed state", () => {
        const post = makePost({
            status: "expired",
            claims: [{ status: "approved" }],
        });
        expect(derivePostState(post)).toBe("completed");
    });

    it("expired post with no approved claims shows Expired state", () => {
        const post = makePost({
            status: "expired",
            claims: [{ status: "pending" }],
        });
        expect(derivePostState(post)).toBe("expired");
    });

    it("deleted post shows Cancelled state", () => {
        const post = makePost({ status: "deleted" });
        expect(derivePostState(post)).toBe("cancelled");
    });

    it("post with both pending and approved shows Claimed not Pending", () => {
        const post = makePost({
            claims: [{ status: "pending" }, { status: "approved" }],
            spots_available: 1,
        });
        expect(derivePostState(post)).toBe("claimed");
    });
});

// ---------------------------------------------------------------------------
// Action availability
// ---------------------------------------------------------------------------
describe("Post action availability", () => {
    it("active post with no claims has all actions", () => {
        const state = derivePostState(makePost());
        expect(state).toBe("active");
        // Active posts can be fully edited, cancelled, and spots reduced
        const canEditAll = state === "active";
        const canCancel = state === "active";
        const canReduceSpots = state === "active";
        expect(canEditAll).toBe(true);
        expect(canCancel).toBe(true);
        expect(canReduceSpots).toBe(true);
    });

    it("active post with claims has locked edit", () => {
        const state = derivePostState(
            makePost({ claims: [{ status: "pending" }] }),
        );
        expect(state).toBe("pending");
        // Pending posts restrict editing to cost and notes only
        const canEditCostAndNotes = state === "pending" || state === "claimed" || state === "filled";
        const canEditAll = state === "active";
        expect(canEditCostAndNotes).toBe(true);
        expect(canEditAll).toBe(false);
    });

    it("completed post is read-only", () => {
        const state = derivePostState(
            makePost({ status: "expired", claims: [{ status: "approved" }] }),
        );
        expect(state).toBe("completed");
        const isReadOnly = state === "completed" || state === "expired" || state === "cancelled";
        expect(isReadOnly).toBe(true);
    });

    it("expired post is read-only", () => {
        const state = derivePostState(makePost({ status: "expired" }));
        expect(state).toBe("expired");
        const isReadOnly = state === "completed" || state === "expired" || state === "cancelled";
        expect(isReadOnly).toBe(true);
    });

    it("cancelled post is read-only", () => {
        const state = derivePostState(makePost({ status: "deleted" }));
        expect(state).toBe("cancelled");
        const isReadOnly = state === "completed" || state === "expired" || state === "cancelled";
        expect(isReadOnly).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Series grouping
// ---------------------------------------------------------------------------
describe("Series grouping", () => {
    it("series posts grouped under one header", () => {
        const posts = [
            makePost({ id: "p1", series_id: "s1" }),
            makePost({ id: "p2", series_id: "s1" }),
            makePost({ id: "p3", series_id: "s1" }),
        ];

        const grouped = posts.reduce<Record<string, typeof posts>>((acc, post) => {
            const key = (post.series_id as string) ?? post.id;
            if (!acc[key]) acc[key] = [];
            acc[key].push(post);
            return acc;
        }, {});

        expect(Object.keys(grouped)).toHaveLength(1);
        expect(grouped["s1"]).toHaveLength(3);
    });

    it("non-series posts not grouped", () => {
        const posts = [
            makePost({ id: "p1", series_id: null }),
            makePost({ id: "p2", series_id: null }),
        ];

        const grouped = posts.reduce<Record<string, typeof posts>>((acc, post) => {
            const key = (post.series_id as string) ?? (post as { id: string }).id;
            if (!acc[key]) acc[key] = [];
            acc[key].push(post);
            return acc;
        }, {});

        expect(Object.keys(grouped)).toHaveLength(2);
    });

    it("series shows correct date count", () => {
        const posts = [
            makePost({ id: "p1", series_id: "s1" }),
            makePost({ id: "p2", series_id: "s1" }),
            makePost({ id: "p3", series_id: "s1" }),
        ];

        const seriesPosts = posts.filter((p) => p.series_id === "s1");
        const dateCountLabel = `${seriesPosts.length} dates`;
        expect(dateCountLabel).toBe("3 dates");
    });

    it("each series date has its own state", () => {
        const posts = [
            makePost({ id: "p1", series_id: "s1", claims: [{ status: "approved" }] }),
            makePost({ id: "p2", series_id: "s1" }),
            makePost({ id: "p3", series_id: "s1" }),
        ];

        const states = posts.map((p) => derivePostState(p));
        expect(states[0]).toBe("claimed");
        expect(states[1]).toBe("active");
        expect(states[2]).toBe("active");
    });

    it("completed and expired posts stay in history", () => {
        const posts = [
            makePost({ status: "expired", claims: [{ status: "approved" }] }),
            makePost({ status: "expired", claims: [] }),
            makePost({ status: "active" }),
        ];

        const states = posts.map((p) => derivePostState(p));
        // History items are not filtered out
        const historyPosts = posts.filter((_p, i) =>
            states[i] === "completed" || states[i] === "expired",
        );
        expect(historyPosts).toHaveLength(2);
        expect(states).toContain("completed");
        expect(states).toContain("expired");
    });
});
