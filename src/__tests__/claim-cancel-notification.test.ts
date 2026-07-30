import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc: vi.fn(),
        functions: { invoke: vi.fn() },
    },
}));

const rpc = vi.mocked(supabase.rpc);
const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
    rpc.mockReset();
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { recipients: 1, delivered: 1 }, error: null } as never);
});

/**
 * Cancelling a claim never notified anyone. `handleCancel` called unclaim() and
 * refreshed the feed — no dispatch had ever been there, so a poster whose spot
 * was claimed and then dropped only found out by noticing.
 *
 * These mirror the branch in claim-detail-sheet's handleCancel rather than
 * rendering the sheet, keeping to the convention in claim-state-machine.test.ts.
 * What they pin down is the decision the fix introduced: which type gets sent,
 * and that nothing is sent when the cancel didn't happen.
 */
async function cancelClaim(claimId: string) {
    const { data, error } = await supabase.rpc("unclaim", { p_claim_id: claimId });
    if (error || !data?.success) return null;

    return sendNotification({
        notification_type: data.prior_status === "approved" ? "claimer_backed_out" : "claimer_cancelled",
        claim_id: claimId,
    });
}

const bodyOf = (call: number) => invoke.mock.calls[call][1]?.body as Record<string, unknown>;

describe("cancelling a claim notifies the poster", () => {
    it("a pending claim sends claimer_cancelled", async () => {
        rpc.mockResolvedValueOnce({ data: { success: true, prior_status: "pending" }, error: null } as never);

        await cancelClaim("claim-1");

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(bodyOf(0)).toEqual({ notification_type: "claimer_cancelled", claim_id: "claim-1" });
    });

    // Backing out of a spot you'd been given is the more disruptive case and the
    // copy differs, so the prior status has to drive the choice.
    it("an approved claim sends claimer_backed_out", async () => {
        rpc.mockResolvedValueOnce({ data: { success: true, prior_status: "approved" }, error: null } as never);

        await cancelClaim("claim-2");

        expect(bodyOf(0)).toEqual({ notification_type: "claimer_backed_out", claim_id: "claim-2" });
    });

    // unclaim reports a missed cancel as {success:false} with no rpc error, so
    // checking only `error` would notify the poster about a cancel that never
    // happened. That was the shape of the original bug's neighbourhood.
    it("sends nothing when unclaim reports success:false", async () => {
        rpc.mockResolvedValueOnce({ data: { success: false, error: "Claim not found" }, error: null } as never);

        await cancelClaim("claim-3");

        expect(invoke).not.toHaveBeenCalled();
    });

    it("sends nothing when the rpc itself errors", async () => {
        rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);

        await cancelClaim("claim-4");

        expect(invoke).not.toHaveBeenCalled();
    });

    // The server derives the recipient from the claim; the browser naming one is
    // the hole PR #62 closed.
    it("never names a recipient", async () => {
        rpc.mockResolvedValueOnce({ data: { success: true, prior_status: "pending" }, error: null } as never);

        await cancelClaim("claim-5");

        expect(bodyOf(0)).not.toHaveProperty("user_id");
        expect(bodyOf(0)).not.toHaveProperty("data");
    });
});
