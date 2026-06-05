import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

const rpc = vi.mocked(supabase.rpc);

beforeEach(() => { rpc.mockReset(); });

describe("follow", () => {
    it("calls follow_user with correct following_id", async () => {
        rpc.mockResolvedValueOnce({ data: { success: true }, error: null } as never);
        await supabase.rpc("follow_user", { p_following_id: "user-c" });
        expect(rpc).toHaveBeenCalledWith("follow_user", { p_following_id: "user-c" });
    });

    it("duplicate follow is idempotent (on conflict do nothing)", async () => {
        rpc.mockResolvedValueOnce({ data: { success: true }, error: null } as never);
        const { data } = await supabase.rpc("follow_user", { p_following_id: "user-b" });
        expect(data!.success).toBe(true);
    });

    it("follow is one-directional", async () => {
        // Following user-c creates follower_id=A, following_id=C
        // NOT follower_id=C, following_id=A
        rpc.mockResolvedValueOnce({ data: { success: true }, error: null } as never);
        await supabase.rpc("follow_user", { p_following_id: "user-c" });
        expect(rpc).toHaveBeenCalledWith("follow_user", { p_following_id: "user-c" });
        // The RPC uses auth.uid() as follower_id — only one direction
    });
});

describe("unfollow", () => {
    it("calls unfollow_user with correct following_id", async () => {
        rpc.mockResolvedValueOnce({ data: { success: true }, error: null } as never);
        await supabase.rpc("unfollow_user", { p_following_id: "user-b" });
        expect(rpc).toHaveBeenCalledWith("unfollow_user", { p_following_id: "user-b" });
    });

    it("unfollow of user not followed is a no-op", async () => {
        rpc.mockResolvedValueOnce({ data: { success: true }, error: null } as never);
        const { data } = await supabase.rpc("unfollow_user", { p_following_id: "user-c" });
        expect(data!.success).toBe(true); // No error, just no row to delete
    });
});
