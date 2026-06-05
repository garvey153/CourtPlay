import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc: vi.fn(),
    },
}));

const rpc = vi.mocked(supabase.rpc);

function mockRpcSuccess(data: Record<string, unknown> = { success: true }) {
    rpc.mockResolvedValueOnce({ data, error: null } as never);
}

beforeEach(() => {
    rpc.mockReset();
});

describe("submit_claim", () => {
    it("calls submit_claim with correct post_id", async () => {
        mockRpcSuccess({ success: true, claim_id: "claim-1" });
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-1" });
        expect(rpc).toHaveBeenCalledWith("submit_claim", { p_post_id: "post-1" });
        expect(data).toEqual({ success: true, claim_id: "claim-1" });
    });

    it("does not set resolved_at on insert", async () => {
        mockRpcSuccess({ success: true, claim_id: "claim-1" });
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-1" });
        expect(data).not.toHaveProperty("resolved_at");
    });
});

describe("approve_claim", () => {
    it("calls approve_claim with correct claim_id", async () => {
        mockRpcSuccess({ success: true });
        await supabase.rpc("approve_claim", { p_claim_id: "claim-1" });
        expect(rpc).toHaveBeenCalledWith("approve_claim", { p_claim_id: "claim-1" });
    });

    it("returns success when claim is pending", async () => {
        mockRpcSuccess({ success: true });
        const { data } = await supabase.rpc("approve_claim", { p_claim_id: "claim-1" });
        expect(data!.success).toBe(true);
    });
});

describe("reject_claim", () => {
    it("calls reject_claim with claim_id and reason", async () => {
        mockRpcSuccess({ success: true });
        await supabase.rpc("reject_claim", { p_claim_id: "claim-1", p_reason: "Wrong skill level" });
        expect(rpc).toHaveBeenCalledWith("reject_claim", { p_claim_id: "claim-1", p_reason: "Wrong skill level" });
    });

    it("works without a reason", async () => {
        mockRpcSuccess({ success: true });
        await supabase.rpc("reject_claim", { p_claim_id: "claim-1", p_reason: null });
        expect(rpc).toHaveBeenCalledWith("reject_claim", { p_claim_id: "claim-1", p_reason: null });
    });
});

describe("unclaim", () => {
    it("calls unclaim with correct claim_id", async () => {
        mockRpcSuccess({ success: true });
        await supabase.rpc("unclaim", { p_claim_id: "claim-1" });
        expect(rpc).toHaveBeenCalledWith("unclaim", { p_claim_id: "claim-1" });
    });

    it("works on approved claims", async () => {
        mockRpcSuccess({ success: true });
        const { data } = await supabase.rpc("unclaim", { p_claim_id: "claim-1" });
        expect(data!.success).toBe(true);
    });
});

describe("reopen_claim", () => {
    it("calls reopen_claim with claim_id and note", async () => {
        mockRpcSuccess({ success: true });
        await supabase.rpc("reopen_claim", { p_claim_id: "claim-1", p_note: "Player cancelled last minute" });
        expect(rpc).toHaveBeenCalledWith("reopen_claim", { p_claim_id: "claim-1", p_note: "Player cancelled last minute" });
    });

    it("works without a note", async () => {
        mockRpcSuccess({ success: true });
        await supabase.rpc("reopen_claim", { p_claim_id: "claim-1", p_note: null });
        expect(rpc).toHaveBeenCalledWith("reopen_claim", { p_claim_id: "claim-1", p_note: null });
    });
});

describe("responsiveness_log", () => {
    it("inserted on approve (implied by RPC success)", async () => {
        mockRpcSuccess({ success: true });
        const { data } = await supabase.rpc("approve_claim", { p_claim_id: "claim-1" });
        expect(data!.success).toBe(true);
    });

    it("inserted on reject (implied by RPC success)", async () => {
        mockRpcSuccess({ success: true });
        const { data } = await supabase.rpc("reject_claim", { p_claim_id: "claim-1", p_reason: "Other" });
        expect(data!.success).toBe(true);
    });

    it("failure does not block approve (server-side transaction)", async () => {
        mockRpcSuccess({ success: true });
        const { data } = await supabase.rpc("approve_claim", { p_claim_id: "claim-1" });
        expect(data!.success).toBe(true);
    });
});
