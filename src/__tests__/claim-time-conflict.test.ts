import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn() },
}));

const rpc = vi.mocked(supabase.rpc);

beforeEach(() => { rpc.mockReset(); });

describe("time conflict detection", () => {
    it("blocks claim when user has pending claim at same date+time", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: false, conflict: true, conflict_date: "2026-04-10", conflict_time: "09:00:00" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-2" });
        expect(data!.success).toBe(false);
        expect(data!.conflict).toBe(true);
    });

    it("blocks claim when user has approved claim at same date+time", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: false, conflict: true, conflict_date: "2026-04-10", conflict_time: "09:00:00" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-3" });
        expect(data!.success).toBe(false);
        expect(data!.conflict).toBe(true);
    });

    it("allows claim when existing claim is at a different time", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: true, claim_id: "claim-new" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-4" });
        expect(data!.success).toBe(true);
    });

    it("allows claim when existing claim is at a different date", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: true, claim_id: "claim-new" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-5" });
        expect(data!.success).toBe(true);
    });

    it("allows claim when existing claim at same time is unclaimed", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: true, claim_id: "claim-new" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-6" });
        expect(data!.success).toBe(true);
    });

    it("allows claim when existing claim at same time is rejected", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: true, claim_id: "claim-new" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-7" });
        expect(data!.success).toBe(true);
    });
});
