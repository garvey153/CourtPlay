import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        functions: {
            invoke: vi.fn(),
        },
    },
}));

const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { recipients: 1, delivered: 1 }, error: null } as never);
});

/**
 * The client's half of the notification contract.
 *
 * It names a type and points at a row. It does not choose a recipient and does
 * not write the copy — those are derived server-side from the row, after an
 * entitlement check. What is worth testing here is therefore what the client is
 * *allowed to say*, because the previous contract (client supplies `user_id`
 * plus a `data` blob) is what made the anon key enough to notify anyone.
 *
 * These replace a suite that asserted the library forwarded its own argument
 * and named the results things like "sends push when push_enabled" — a decision
 * the client has never made.
 */
describe("sendNotification", () => {
    it("forwards the request to the edge function unchanged", async () => {
        await sendNotification({ notification_type: "claim_submitted", claim_id: "claim-1" });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: { notification_type: "claim_submitted", claim_id: "claim-1" },
        });
    });

    // Regression guard for the auth hole: if either field comes back, the client
    // is choosing recipients and copy again.
    it("never sends a recipient or a copy payload", async () => {
        await sendNotification({ notification_type: "claim_approved", claim_id: "claim-2" });

        const body = invoke.mock.calls[0][1]?.body as Record<string, unknown>;
        expect(body).not.toHaveProperty("user_id");
        expect(body).not.toHaveProperty("data");
    });

    it("passes old_cost through, since the server cannot recover it", async () => {
        await sendNotification({ notification_type: "price_drop", post_id: "post-1", old_cost: "40.00" });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: { notification_type: "price_drop", post_id: "post-1", old_cost: "40.00" },
        });
    });

    it("returns the server's recipient and delivery counts", async () => {
        invoke.mockResolvedValueOnce({ data: { recipients: 4, delivered: 3 }, error: null } as never);

        await expect(sendNotification({ notification_type: "friend_new_post", post_id: "post-2" }))
            .resolves.toEqual({ recipients: 4, delivered: 3, pushFailed: 0 });
    });

    it("reports zero rather than undefined when the server omits the counts", async () => {
        invoke.mockResolvedValueOnce({ data: {}, error: null } as never);

        await expect(sendNotification({ notification_type: "spot_reopened", post_id: "post-3" }))
            .resolves.toEqual({ recipients: 0, delivered: 0, pushFailed: 0 });
    });

    // The triggering action has already succeeded by the time this runs, so a
    // failed notification must never surface as a failure of that action.
    it("returns null instead of throwing when the function reports an error", async () => {
        invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);

        await expect(sendNotification({ notification_type: "claim_rejected", claim_id: "claim-3" }))
            .resolves.toBeNull();
    });

    it("returns null instead of throwing when invoke itself rejects", async () => {
        invoke.mockRejectedValueOnce(new Error("network down"));

        await expect(sendNotification({ notification_type: "claim_rejected", claim_id: "claim-4" }))
            .resolves.toBeNull();
    });

    it("never sends an SMS channel — V1 is push and email only", async () => {
        await sendNotification({ notification_type: "spot_reopened", post_id: "post-4" });

        const body = invoke.mock.calls[0][1]?.body as Record<string, unknown>;
        expect(body).not.toHaveProperty("sms");
        expect(body).not.toHaveProperty("channel");
    });
});

/**
 * A push OneSignal declines is not an HTTP failure — it answers 200 with an
 * `errors` array — so nothing in the normal error path catches it. The detail
 * came back in the response all along and was discarded, which is how a real
 * claim_approved push went missing in production with no trace: the server
 * writes a notifications row only on success, and `delivered` is satisfied by
 * the email that did land.
 */
describe("a declined push is reported", () => {
    const declined = {
        recipients: 1,
        delivered: 1,
        pushFailed: 1,
        deliveries: [{
            user_id: "u1",
            pushSent: false,
            emailSent: true,
            results: { push: { onesignal: { id: "", errors: ["All included players are not subscribed"] } } },
        }],
    };

    it("counts it, even though the recipient counts as delivered", async () => {
        invoke.mockResolvedValueOnce({ data: declined, error: null } as never);

        await expect(sendNotification({ notification_type: "claim_approved", claim_id: "c1" }))
            .resolves.toEqual({ recipients: 1, delivered: 1, pushFailed: 1 });
    });

    it("warns with the OneSignal reason", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        invoke.mockResolvedValueOnce({ data: declined, error: null } as never);

        await sendNotification({ notification_type: "claim_approved", claim_id: "c1" });

        expect(warn).toHaveBeenCalledWith(
            "Push not delivered:", "claim_approved", "u1",
            expect.objectContaining({ errors: ["All included players are not subscribed"] }),
        );
        warn.mockRestore();
    });

    it("stays quiet when push was never attempted", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        invoke.mockResolvedValueOnce({
            data: { recipients: 1, delivered: 1, pushFailed: 0, deliveries: [{ user_id: "u1", pushSent: false, emailSent: true, results: {} }] },
            error: null,
        } as never);

        await sendNotification({ notification_type: "connection_closed", post_id: "p1" });

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("stays quiet when the push landed", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        invoke.mockResolvedValueOnce({
            data: { recipients: 1, delivered: 1, pushFailed: 0, deliveries: [{ user_id: "u1", pushSent: true, emailSent: true, results: { push: { onesignal: { id: "abc" } } } }] },
            error: null,
        } as never);

        await sendNotification({ notification_type: "claim_approved", claim_id: "c1" });

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
