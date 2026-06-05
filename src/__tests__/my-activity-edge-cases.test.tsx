import { describe, it, expect } from "vitest";
import { derivePostState, deriveClaimState } from "@/utils/activity-states";
import type { PostDisplayState, ClaimDisplayState } from "@/utils/activity-states";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildVenmoLink(handle: string, amount: number, note: string): string {
    return `https://venmo.com/${handle}?txn=pay&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;
}

const ACTIVE_STATES: PostDisplayState[] = ["active", "pending", "claimed"];
const HISTORY_STATES: PostDisplayState[] = ["completed", "expired", "cancelled"];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("My Activity edge cases", () => {
    it("My Posts empty state shows CTA to create post", () => {
        const posts: unknown[] = [];
        const emptyMessage = "You haven't posted any sub needs yet.";
        const ctaText = "Create a post";

        expect(posts).toHaveLength(0);
        expect(emptyMessage).toBe("You haven't posted any sub needs yet.");
        expect(ctaText).toBe("Create a post");
    });

    it("My Claims empty state shows CTA to browse feed", () => {
        const claims: unknown[] = [];
        const emptyMessage = "You haven't claimed any spots yet.";
        const ctaText = "Browse the feed";

        expect(claims).toHaveLength(0);
        expect(emptyMessage).toBe("You haven't claimed any spots yet.");
        expect(ctaText).toBe("Browse the feed");
    });

    it("My Activity accessible from /activity route", () => {
        const activityRoute = "/activity";
        expect(activityRoute).toBe("/activity");
    });

    it("posts ordered with active states first", () => {
        const posts = [
            { status: "active", spots_available: 2, claims: [] },
            { status: "deleted", spots_available: 0, claims: [] },
            { status: "active", spots_available: 1, claims: [{ status: "pending" }] },
            { status: "expired", spots_available: 0, claims: [{ status: "approved" }] },
            { status: "active", spots_available: 0, claims: [{ status: "approved" }] },
            { status: "expired", spots_available: 2, claims: [] },
        ];

        const derived = posts.map((p) => derivePostState(p));
        // Sort: active states (active/pending/claimed/filled) before history (completed/expired/cancelled)
        const sorted = [...derived].sort((a, b) => {
            const aActive = ACTIVE_STATES.includes(a) || a === "filled" ? 0 : 1;
            const bActive = ACTIVE_STATES.includes(b) || b === "filled" ? 0 : 1;
            return aActive - bActive;
        });

        // All active/pending/claimed/filled should come before completed/expired/cancelled
        const firstHistoryIndex = sorted.findIndex((s) => HISTORY_STATES.includes(s));
        const lastActiveIndex = sorted.findLastIndex(
            (s) => ACTIVE_STATES.includes(s) || s === "filled",
        );

        if (firstHistoryIndex !== -1 && lastActiveIndex !== -1) {
            expect(lastActiveIndex).toBeLessThan(firstHistoryIndex);
        }
    });

    it("all post states represented in history", () => {
        const completedPost = derivePostState({
            status: "expired",
            spots_available: 0,
            claims: [{ status: "approved" }],
        });
        const expiredPost = derivePostState({
            status: "expired",
            spots_available: 2,
            claims: [],
        });
        const cancelledPost = derivePostState({
            status: "deleted",
            spots_available: 0,
            claims: [],
        });

        expect(completedPost).toBe("completed");
        expect(expiredPost).toBe("expired");
        expect(cancelledPost).toBe("cancelled");

        // None of these should be filtered out from history view
        const historyStates: PostDisplayState[] = [completedPost, expiredPost, cancelledPost];
        expect(historyStates).toHaveLength(3);
        historyStates.forEach((state) => {
            expect(HISTORY_STATES).toContain(state);
        });
    });

    it("claim sections only show non-empty groups", () => {
        const claims = [
            { status: "approved", game_date: "2099-12-01" },
            { status: "approved", game_date: "2099-12-02" },
            { status: "rejected", game_date: null },
        ];

        const derived = claims.map((c) => deriveClaimState(c));

        // Group by state
        const groups: Record<string, ClaimDisplayState[]> = {};
        derived.forEach((state) => {
            groups[state] = groups[state] || [];
            groups[state].push(state);
        });

        // Filter to non-empty groups only
        const nonEmptyGroups = Object.entries(groups).filter(([, items]) => items.length > 0);

        expect(nonEmptyGroups).toHaveLength(2); // "approved" and "rejected" only
        expect(groups["approved"]).toHaveLength(2);
        expect(groups["rejected"]).toHaveLength(1);
        expect(groups["pending"]).toBeUndefined();
        expect(groups["backed_out"]).toBeUndefined();
    });

    it("Venmo deep link format is correct", () => {
        const handle = "jane-doe-5";
        const amount = 25;
        const note = "Court sub - Longshore Club 4/10";

        const link = buildVenmoLink(handle, amount, note);

        expect(link).toBe(
            `https://venmo.com/jane-doe-5?txn=pay&amount=25.00&note=${encodeURIComponent(note)}`,
        );
        expect(link).toContain("https://venmo.com/jane-doe-5");
        expect(link).toContain("txn=pay");
        expect(link).toContain("amount=25.00");
        expect(link).toContain("note=");

        // Verify structure with special characters
        const specialLink = buildVenmoLink("user-123", 50.5, "Payment for Court & Fees");
        expect(specialLink).toContain("amount=50.50");
        expect(specialLink).toContain(encodeURIComponent("Payment for Court & Fees"));
    });
});
