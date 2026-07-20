import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALERT_THRESHOLD, upsertCustomCourt } from "./custom-court";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: mockRpc },
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("upsertCustomCourt", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRpc.mockResolvedValue({ data: null, error: null });
    });

    it("records the submission via the SECURITY DEFINER RPC", async () => {
        await upsertCustomCourt("Longshore Tennis Club", "Westport");

        expect(mockRpc).toHaveBeenCalledWith("record_custom_court_submission", {
            p_name: "Longshore Tennis Club",
            p_area: "Westport",
        });
    });

    it("passes null area when none is provided", async () => {
        await upsertCustomCourt("No Area Club");

        expect(mockRpc).toHaveBeenCalledWith("record_custom_court_submission", {
            p_name: "No Area Club",
            p_area: null,
        });
    });

    it("normalizes a blank/whitespace area to null", async () => {
        await upsertCustomCourt("Blank Area Club", "   ");

        expect(mockRpc).toHaveBeenCalledWith("record_custom_court_submission", {
            p_name: "Blank Area Club",
            p_area: null,
        });
    });

    it("trims the provided area", async () => {
        await upsertCustomCourt("Padded Club", "  Fairfield  ");

        expect(mockRpc).toHaveBeenCalledWith("record_custom_court_submission", {
            p_name: "Padded Club",
            p_area: "Fairfield",
        });
    });

    it("does not throw when the RPC returns an error", async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: "denied" } });

        await expect(upsertCustomCourt("Any Club")).resolves.toBeUndefined();
    });
});

describe("ALERT_THRESHOLD constant", () => {
    it("is 3", () => {
        expect(ALERT_THRESHOLD).toBe(3);
    });
});
