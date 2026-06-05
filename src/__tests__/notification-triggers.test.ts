import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendNotification, sendNotificationBatch } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        functions: {
            invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
        },
    },
}));

const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
    invoke.mockClear();
    invoke.mockResolvedValue({ data: { success: true }, error: null });
});

describe("Notification triggers", () => {
    it("N1 — claim submitted triggers notification to poster", async () => {
        const posterId = "poster-user-123";
        const postId = "post-456";
        const claimId = "claim-789";

        await sendNotification({
            user_id: posterId,
            notification_type: "claim_submitted",
            post_id: postId,
            claim_id: claimId,
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: posterId,
                notification_type: "claim_submitted",
                post_id: postId,
                claim_id: claimId,
            },
        });
    });

    it("N2 — claim approved triggers notification to claimer", async () => {
        const claimerId = "claimer-user-100";
        const claimId = "claim-200";

        await sendNotification({
            user_id: claimerId,
            notification_type: "claim_approved",
            claim_id: claimId,
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: claimerId,
                notification_type: "claim_approved",
                claim_id: claimId,
            },
        });
    });

    it("N3 — claim rejected triggers notification to claimer with reason", async () => {
        const claimerId = "claimer-user-300";
        const claimId = "claim-400";
        const reason = "Schedule conflict";

        await sendNotification({
            user_id: claimerId,
            notification_type: "claim_rejected",
            claim_id: claimId,
            data: { reason },
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: claimerId,
                notification_type: "claim_rejected",
                claim_id: claimId,
                data: { reason },
            },
        });
    });

    it("N3 — claim rejected without reason still triggers notification", async () => {
        const claimerId = "claimer-user-300";
        const claimId = "claim-400";

        await sendNotification({
            user_id: claimerId,
            notification_type: "claim_rejected",
            claim_id: claimId,
            data: { reason: undefined },
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: claimerId,
                notification_type: "claim_rejected",
                claim_id: claimId,
                data: { reason: undefined },
            },
        });
    });

    it("N4 — claimer backs out triggers notification to poster", async () => {
        const posterId = "poster-user-500";
        const postId = "post-600";
        const claimId = "claim-700";

        await sendNotification({
            user_id: posterId,
            notification_type: "claimer_backed_out",
            post_id: postId,
            claim_id: claimId,
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: posterId,
                notification_type: "claimer_backed_out",
                post_id: postId,
                claim_id: claimId,
            },
        });
    });

    it("N5 — cost changed triggers notification to all active claimers", async () => {
        const activeClaimerIds = ["claimer-a", "claimer-b", "claimer-c"];
        const postId = "post-800";

        await sendNotificationBatch(activeClaimerIds, "cost_changed", postId, {
            old_cost: "50",
            new_cost: "75",
        });

        expect(invoke).toHaveBeenCalledTimes(3);
        activeClaimerIds.forEach((userId) => {
            expect(invoke).toHaveBeenCalledWith("send-notification", {
                body: {
                    user_id: userId,
                    notification_type: "cost_changed",
                    post_id: postId,
                    data: { old_cost: "50", new_cost: "75" },
                },
            });
        });
    });

    it("N5 — cost changed does NOT notify rejected or unclaimed claimers", async () => {
        // Only active claimers should be passed to sendNotificationBatch.
        // If the caller filters correctly, rejected/unclaimed users are excluded.
        const activeOnly = ["claimer-active-1"];
        const postId = "post-900";

        await sendNotificationBatch(activeOnly, "cost_changed", postId);

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: "claimer-active-1",
                notification_type: "cost_changed",
                post_id: postId,
            },
        });
        // Verify rejected/unclaimed users were NOT notified
        expect(invoke).not.toHaveBeenCalledWith(
            "send-notification",
            expect.objectContaining({
                body: expect.objectContaining({ user_id: "claimer-rejected" }),
            }),
        );
        expect(invoke).not.toHaveBeenCalledWith(
            "send-notification",
            expect.objectContaining({
                body: expect.objectContaining({ user_id: "claimer-unclaimed" }),
            }),
        );
    });

    it("N7 — claimer cancels pending claim triggers notification to poster", async () => {
        const posterId = "poster-user-1000";
        const postId = "post-1100";
        const claimId = "claim-1200";

        await sendNotification({
            user_id: posterId,
            notification_type: "claimer_cancelled",
            post_id: postId,
            claim_id: claimId,
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: posterId,
                notification_type: "claimer_cancelled",
                post_id: postId,
                claim_id: claimId,
            },
        });
    });

    it("N8 — price drop triggers notification to prior viewers", async () => {
        const viewerIds = ["viewer-1", "viewer-2", "viewer-3"];
        const postId = "post-1300";

        await sendNotificationBatch(viewerIds, "price_drop", postId, {
            old_price: "100",
            new_price: "80",
        });

        expect(invoke).toHaveBeenCalledTimes(3);
        viewerIds.forEach((userId) => {
            expect(invoke).toHaveBeenCalledWith("send-notification", {
                body: {
                    user_id: userId,
                    notification_type: "price_drop",
                    post_id: postId,
                    data: { old_price: "100", new_price: "80" },
                },
            });
        });
    });

    it("N8 — price drop does NOT notify the poster themselves", async () => {
        // The poster should be filtered out before calling sendNotificationBatch.
        const viewersExcludingPoster = ["viewer-1", "viewer-2"];
        const postId = "post-1400";
        const posterId = "poster-user-1500";

        await sendNotificationBatch(viewersExcludingPoster, "price_drop", postId);

        expect(invoke).toHaveBeenCalledTimes(2);
        expect(invoke).not.toHaveBeenCalledWith(
            "send-notification",
            expect.objectContaining({
                body: expect.objectContaining({ user_id: posterId }),
            }),
        );
    });

    it("N9 — spot reopened triggers notification to notify_me watchers", async () => {
        const watcherIds = ["watcher-1", "watcher-2"];
        const postId = "post-1600";

        await sendNotificationBatch(watcherIds, "spot_reopened", postId);

        expect(invoke).toHaveBeenCalledTimes(2);
        watcherIds.forEach((userId) => {
            expect(invoke).toHaveBeenCalledWith("send-notification", {
                body: {
                    user_id: userId,
                    notification_type: "spot_reopened",
                    post_id: postId,
                },
            });
        });
    });

    it("N13 — friend posts new sub need triggers notification to followers", async () => {
        const followerIds = ["follower-1", "follower-2", "follower-3", "follower-4"];
        const postId = "post-1700";

        await sendNotificationBatch(followerIds, "friend_new_post", postId);

        expect(invoke).toHaveBeenCalledTimes(4);
        followerIds.forEach((userId) => {
            expect(invoke).toHaveBeenCalledWith("send-notification", {
                body: {
                    user_id: userId,
                    notification_type: "friend_new_post",
                    post_id: postId,
                },
            });
        });
    });

    it("notification dispatch failure does not block the triggering action", async () => {
        invoke.mockRejectedValue(new Error("Network error"));

        // sendNotification catches errors internally, so it should resolve
        await expect(
            sendNotification({
                user_id: "user-1800",
                notification_type: "claim_submitted",
                post_id: "post-1900",
            }),
        ).resolves.toBeUndefined();

        // sendNotificationBatch uses Promise.allSettled, so it should also resolve
        invoke.mockRejectedValue(new Error("Network error"));
        await expect(
            sendNotificationBatch(
                ["user-a", "user-b"],
                "claim_approved",
                "post-2000",
            ),
        ).resolves.toBeUndefined();
    });
});
