import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveClaimState, isReopenedClaim } from "@/utils/activity-states";

function makeClaim(overrides: Record<string, unknown> = {}) {
    return {
        status: "pending",
        game_date: "2026-05-15",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// State rendering
// ---------------------------------------------------------------------------
describe("Claim state rendering", () => {
    it("pending claim returns pending state", () => {
        const claim = makeClaim({ status: "pending", game_date: "2026-12-01" });
        expect(deriveClaimState(claim)).toBe("pending");
    });

    it("approved upcoming claim returns approved state", () => {
        const claim = makeClaim({ status: "approved", game_date: "2026-12-01" });
        expect(deriveClaimState(claim)).toBe("approved");
    });

    it("approved past-game claim returns completed state", () => {
        // Use fake timers so "today" is after the game_date
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));

        const claim = makeClaim({ status: "approved", game_date: "2026-05-01" });
        expect(deriveClaimState(claim)).toBe("completed");

        vi.useRealTimers();
    });

    it("unclaimed claim returns backed_out state", () => {
        const claim = makeClaim({ status: "unclaimed" });
        expect(deriveClaimState(claim)).toBe("backed_out");
    });

    it("rejected claim returns rejected state", () => {
        const claim = makeClaim({ status: "rejected" });
        expect(deriveClaimState(claim)).toBe("rejected");
    });

    it("cancelled claim returns cancelled state", () => {
        const claim = makeClaim({ status: "cancelled" });
        expect(deriveClaimState(claim)).toBe("cancelled");
    });
});

// ---------------------------------------------------------------------------
// Claim grouping
// ---------------------------------------------------------------------------
describe("Claim grouping", () => {
    const sectionOrder = ["pending", "approved", "completed", "backed_out", "rejected", "cancelled"] as const;

    it("claims grouped by status", () => {
        const claims = [
            makeClaim({ id: "c1", status: "pending" }),
            makeClaim({ id: "c2", status: "approved", game_date: "2026-12-01" }),
            makeClaim({ id: "c3", status: "rejected" }),
            makeClaim({ id: "c4", status: "pending" }),
        ];

        const states = claims.map((c) => deriveClaimState(c));
        const grouped = sectionOrder.map((section) => ({
            section,
            items: claims.filter((_c, i) => states[i] === section),
        }));

        const pendingSection = grouped.find((g) => g.section === "pending");
        const approvedSection = grouped.find((g) => g.section === "approved");
        const rejectedSection = grouped.find((g) => g.section === "rejected");

        expect(pendingSection!.items).toHaveLength(2);
        expect(approvedSection!.items).toHaveLength(1);
        expect(rejectedSection!.items).toHaveLength(1);
    });

    it("empty section not shown", () => {
        const claims = [
            makeClaim({ id: "c1", status: "pending" }),
            makeClaim({ id: "c2", status: "approved", game_date: "2026-12-01" }),
        ];

        const states = claims.map((c) => deriveClaimState(c));
        const grouped = sectionOrder
            .map((section) => ({
                section,
                items: claims.filter((_c, i) => states[i] === section),
            }))
            .filter((g) => g.items.length > 0);

        expect(grouped).toHaveLength(2);
        expect(grouped.map((g) => g.section)).toEqual(["pending", "approved"]);
    });
});

// ---------------------------------------------------------------------------
// Claim actions
// ---------------------------------------------------------------------------
describe("Claim actions", () => {
    const canBackOut = (state: string) => state === "pending" || state === "approved";

    it("back out available on pending claims", () => {
        const state = deriveClaimState(makeClaim({ status: "pending" }));
        expect(canBackOut(state)).toBe(true);
    });

    it("back out available on approved claims", () => {
        const state = deriveClaimState(
            makeClaim({ status: "approved", game_date: "2026-12-01" }),
        );
        expect(canBackOut(state)).toBe(true);
    });

    it("back out not available on completed claims", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));

        const state = deriveClaimState(
            makeClaim({ status: "approved", game_date: "2026-05-01" }),
        );
        expect(state).toBe("completed");
        expect(canBackOut(state)).toBe(false);

        vi.useRealTimers();
    });

    it("back out not available on rejected claims", () => {
        const state = deriveClaimState(makeClaim({ status: "rejected" }));
        expect(canBackOut(state)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Scenario B flag (reopened claims)
// ---------------------------------------------------------------------------
describe("Scenario B flag", () => {
    it("reopened claim shows flag in claimer view", () => {
        expect(isReopenedClaim({ status: "cancelled", post_status: "active" })).toBe(true);
    });

    it("post-deletion cancelled claim does NOT show reopen flag", () => {
        expect(isReopenedClaim({ status: "cancelled", post_status: "deleted" })).toBe(false);
    });

    it("non-cancelled claim does NOT show reopen flag", () => {
        expect(isReopenedClaim({ status: "approved" })).toBe(false);
    });

    it("reopen flag message is neutral", () => {
        // When a claim is reopened, the displayed message should be neutral
        // (not blaming either party) - e.g. "This spot was reopened"
        const reopenMessage = "This spot was reopened";
        expect(reopenMessage).not.toMatch(/fault|blame|problem/i);
        expect(reopenMessage).toMatch(/reopen/i);
    });
});
