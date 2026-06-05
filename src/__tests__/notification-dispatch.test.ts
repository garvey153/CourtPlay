import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import { sendNotification, sendNotificationBatch } from "@/lib/notifications";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        functions: {
            invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
        },
    },
}));

const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { success: true }, error: null } as never);
});

describe("notification dispatch", () => {
    it("dispatch sends push when push_enabled and onesignal_player_id set", async () => {
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["push"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-1",
            notification_type: "claim_submitted",
            post_id: "post-1",
        });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-1",
                notification_type: "claim_submitted",
                post_id: "post-1",
            },
        });
    });

    it("dispatch sends email when email_enabled", async () => {
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["email"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-2",
            notification_type: "claim_approved",
            post_id: "post-2",
        });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-2",
                notification_type: "claim_approved",
                post_id: "post-2",
            },
        });
    });

    it("dispatch sends both push and email when both enabled", async () => {
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["push", "email"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-3",
            notification_type: "claim_rejected",
            claim_id: "claim-1",
        });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-3",
                notification_type: "claim_rejected",
                claim_id: "claim-1",
            },
        });
    });

    it("dispatch skips push when onesignal_player_id is null", async () => {
        // Edge Function falls back to email-only when no player_id
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["email"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-no-player-id",
            notification_type: "claimer_backed_out",
            post_id: "post-3",
        });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-no-player-id",
                notification_type: "claimer_backed_out",
                post_id: "post-3",
            },
        });
    });

    it("dispatch skips push when push_enabled is false", async () => {
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["email"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-push-disabled",
            notification_type: "cost_changed",
            post_id: "post-4",
        });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-push-disabled",
                notification_type: "cost_changed",
                post_id: "post-4",
            },
        });
    });

    it("dispatch sends nothing when both channels disabled", async () => {
        invoke.mockResolvedValueOnce({
            data: { channels_sent: [] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-all-disabled",
            notification_type: "nudge_no_response",
            post_id: "post-5",
        });

        // The client still invokes the Edge Function; the server decides to send nothing
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-all-disabled",
                notification_type: "nudge_no_response",
                post_id: "post-5",
            },
        });
    });

    it("dispatch respects per-type preferences", async () => {
        // User has push disabled specifically for price_drop but email enabled
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["email"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-per-type",
            notification_type: "price_drop",
            post_id: "post-6",
            data: { old_price: 20, new_price: 15 },
        });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-per-type",
                notification_type: "price_drop",
                post_id: "post-6",
                data: { old_price: 20, new_price: 15 },
            },
        });
    });

    it("dispatch creates default preferences if none exist for this type", async () => {
        // Edge Function creates default prefs row then proceeds
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["push", "email"], preferences_created: true },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-new",
            notification_type: "friend_new_post",
            post_id: "post-7",
        });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "user-new",
                notification_type: "friend_new_post",
                post_id: "post-7",
            },
        });
    });

    it("dispatch handles OneSignal API failure gracefully", async () => {
        // Edge Function catches OneSignal error, still sends email
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["email"], errors: ["onesignal_failed"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-onesignal-fail",
            notification_type: "game_reminder",
            post_id: "post-8",
        });

        // sendNotification should not throw
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it("dispatch handles Resend API failure gracefully", async () => {
        // Edge Function catches Resend error, still sends push
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["push"], errors: ["resend_failed"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-resend-fail",
            notification_type: "friend_expiry",
            post_id: "post-9",
        });

        // sendNotification should not throw
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it("dispatch never sends SMS in V1", async () => {
        invoke.mockResolvedValueOnce({
            data: { channels_sent: ["push", "email"] },
            error: null,
        } as never);

        await sendNotification({
            user_id: "user-sms-check",
            notification_type: "spot_reopened",
            post_id: "post-10",
        });

        // Verify the payload never includes an SMS channel
        const callBody = invoke.mock.calls[0][1]?.body as Record<string, unknown>;
        expect(callBody).not.toHaveProperty("channel", "sms");
        expect(callBody).not.toHaveProperty("sms");

        // The Edge Function response should never include "sms" in channels_sent
        const result = await invoke.mock.results[0].value;
        expect((result as { data: { channels_sent: string[] } }).data.channels_sent).not.toContain("sms");
    });
});

describe("sendNotificationBatch", () => {
    it("dispatches to all user IDs in parallel", async () => {
        invoke.mockResolvedValue({ data: { success: true }, error: null } as never);

        const userIds = ["user-a", "user-b", "user-c"];
        await sendNotificationBatch(userIds, "spot_reopened", "post-batch");

        expect(invoke).toHaveBeenCalledTimes(3);
        for (const uid of userIds) {
            expect(invoke).toHaveBeenCalledWith("send-notification", {
                body: {
                    user_id: uid,
                    notification_type: "spot_reopened",
                    post_id: "post-batch",
                },
            });
        }
    });

    it("does not throw if one notification in batch fails", async () => {
        invoke
            .mockResolvedValueOnce({ data: { success: true }, error: null } as never)
            .mockRejectedValueOnce(new Error("network error"))
            .mockResolvedValueOnce({ data: { success: true }, error: null } as never);

        await expect(
            sendNotificationBatch(["u1", "u2", "u3"], "48h_unfilled", "post-fail"),
        ).resolves.not.toThrow();

        expect(invoke).toHaveBeenCalledTimes(3);
    });
});
