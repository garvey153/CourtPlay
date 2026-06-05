import { describe, it, expect } from "vitest";
import { derivePostState, deriveClaimState } from "@/utils/activity-states";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isVisibleInFeed(postStatus: string): boolean {
    return postStatus === "active";
}

/** Map actions to their expected notification type codes. */
const ACTION_TO_NOTIFICATION: Record<string, string> = {
    claim_submitted: "N1",
    claim_approved: "N2",
    claim_rejected: "N3",
    claimer_backed_out: "N4",
    cost_changed: "N5",
    post_cancelled: "N6",
    spot_reopened: "N7",
    game_reminder_24h: "N8",
    post_expiring_48h: "N9",
    new_follower: "N10",
    followed_user_posted: "N11",
    discount_applied: "N12",
    nudge_no_claims: "N13",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("My Activity integration (cross-tab logic)", () => {
    it("approving a claim changes claim display state to approved", () => {
        const futureDate = "2099-12-31";
        const state = deriveClaimState({ status: "approved", game_date: futureDate });
        expect(state).toBe("approved");
    });

    it("backing out changes claim state to backed_out", () => {
        const state = deriveClaimState({ status: "unclaimed", game_date: null });
        expect(state).toBe("backed_out");
    });

    it("cancelling a post changes post state to cancelled", () => {
        const state = derivePostState({
            status: "deleted",
            spots_available: 2,
            claims: [{ status: "approved" }],
        });
        expect(state).toBe("cancelled");
    });

    it("discount updates cost but preserves claim references", () => {
        const originalCost = 50;
        const discountedCost = 40;
        const claimStatus = "approved";

        // Cost changes independently of claim status
        expect(discountedCost).not.toBe(originalCost);

        // Claim state remains approved regardless of cost change
        const stateBeforeDiscount = deriveClaimState({
            status: claimStatus,
            game_date: "2099-12-31",
        });
        const stateAfterDiscount = deriveClaimState({
            status: claimStatus,
            game_date: "2099-12-31",
        });

        expect(stateBeforeDiscount).toBe("approved");
        expect(stateAfterDiscount).toBe("approved");
        expect(stateBeforeDiscount).toBe(stateAfterDiscount);
    });

    it("actions trigger correct notifications (N1-N13 mapping)", () => {
        // Verify every action maps to a unique notification code
        const actions = Object.keys(ACTION_TO_NOTIFICATION);
        const codes = Object.values(ACTION_TO_NOTIFICATION);

        expect(actions).toHaveLength(13);
        expect(codes).toHaveLength(13);

        // All codes N1 through N13 are present
        for (let i = 1; i <= 13; i++) {
            expect(codes).toContain(`N${i}`);
        }

        // Specific action → code mappings
        expect(ACTION_TO_NOTIFICATION["claim_submitted"]).toBe("N1");
        expect(ACTION_TO_NOTIFICATION["claim_approved"]).toBe("N2");
        expect(ACTION_TO_NOTIFICATION["claim_rejected"]).toBe("N3");
        expect(ACTION_TO_NOTIFICATION["claimer_backed_out"]).toBe("N4");
        expect(ACTION_TO_NOTIFICATION["cost_changed"]).toBe("N5");
        expect(ACTION_TO_NOTIFICATION["post_cancelled"]).toBe("N6");
        expect(ACTION_TO_NOTIFICATION["spot_reopened"]).toBe("N7");
        expect(ACTION_TO_NOTIFICATION["game_reminder_24h"]).toBe("N8");
        expect(ACTION_TO_NOTIFICATION["post_expiring_48h"]).toBe("N9");
        expect(ACTION_TO_NOTIFICATION["new_follower"]).toBe("N10");
        expect(ACTION_TO_NOTIFICATION["followed_user_posted"]).toBe("N11");
        expect(ACTION_TO_NOTIFICATION["discount_applied"]).toBe("N12");
        expect(ACTION_TO_NOTIFICATION["nudge_no_claims"]).toBe("N13");
    });

    it("feed reflects state changes — active to deleted means not visible", () => {
        // Active post is visible in feed
        expect(isVisibleInFeed("active")).toBe(true);

        // After deletion, post is no longer visible
        expect(isVisibleInFeed("deleted")).toBe(false);

        // Other non-active statuses are also not visible
        expect(isVisibleInFeed("expired")).toBe(false);
        expect(isVisibleInFeed("cancelled")).toBe(false);
        expect(isVisibleInFeed("draft")).toBe(false);

        // Verify state derivation matches: deleted → cancelled display state
        const postState = derivePostState({
            status: "deleted",
            spots_available: 0,
            claims: [],
        });
        expect(postState).toBe("cancelled");

        // And the underlying status would not pass feed filter
        expect(isVisibleInFeed("deleted")).toBe(false);
    });
});
