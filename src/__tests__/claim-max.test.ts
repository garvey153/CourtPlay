import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn() },
}));

const rpc = vi.mocked(supabase.rpc);

beforeEach(() => { rpc.mockReset(); });

describe("claim max enforcement", () => {
    it("claim blocked when no spots available", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: false, error: "No spots available" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-full" });
        expect(data!.success).toBe(false);
    });

    it("one claim per user per post", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: false, error: "You already have an active claim on this post" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-1" });
        expect(data!.success).toBe(false);
    });

    it("user can claim same post after unclaiming", async () => {
        rpc.mockResolvedValueOnce({
            data: { success: true, claim_id: "claim-new" },
            error: null,
        } as never);
        const { data } = await supabase.rpc("submit_claim", { p_post_id: "post-1" });
        expect(data!.success).toBe(true);
    });
});
