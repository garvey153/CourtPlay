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

// ---------------------------------------------------------------------------
// Helpers — mirror the filtering logic from activity.tsx handleReducePrice
// ---------------------------------------------------------------------------

/** Return viewer IDs eligible for N8, excluding poster and active claimers. */
function getN8Recipients(
    viewers: string[],
    posterId: string,
    activeClaimerIds: Set<string>,
): string[] {
    return viewers.filter((id) => id !== posterId && !activeClaimerIds.has(id));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POST_ID = "post-1";
const POSTER_ID = "poster-1";
const CLAIMER_A = "claimer-a"; // pending
const CLAIMER_B = "claimer-b"; // approved
const CLAIMER_C = "claimer-c"; // rejected (should NOT receive N5)
const CLAIMER_D = "claimer-d"; // approved
const VIEWER_X = "viewer-x";
const VIEWER_Y = "viewer-y";
const WATCHER_W = "watcher-w";

const ACTIVE_CLAIMER_IDS = new Set([CLAIMER_A, CLAIMER_B, CLAIMER_D]);

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// N5 — cost_changed notifications
// ---------------------------------------------------------------------------

describe("N5 — cost_changed", () => {
    it("notifies a pending claimer with old_cost and new_cost", async () => {
        await sendNotification({
            user_id: CLAIMER_A,
            notification_type: "cost_changed",
            post_id: POST_ID,
            data: { old_cost: "25", new_cost: "15" },
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: CLAIMER_A,
                notification_type: "cost_changed",
                post_id: POST_ID,
                data: { old_cost: "25", new_cost: "15" },
            },
        });
    });

    it("notifies approved claimers (User B and User D)", async () => {
        const approvedClaimers = [CLAIMER_B, CLAIMER_D];

        await sendNotificationBatch(approvedClaimers, "cost_changed", POST_ID, {
            old_cost: "30",
            new_cost: "20",
        });

        expect(invoke).toHaveBeenCalledTimes(2);

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: CLAIMER_B,
                notification_type: "cost_changed",
                post_id: POST_ID,
                data: { old_cost: "30", new_cost: "20" },
            },
        });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: CLAIMER_D,
                notification_type: "cost_changed",
                post_id: POST_ID,
                data: { old_cost: "30", new_cost: "20" },
            },
        });
    });

    it("does not notify rejected or unclaimed claimers", async () => {
        // Only active (pending + approved) claimers should be in the batch
        const activeClaimers = [CLAIMER_A, CLAIMER_B, CLAIMER_D];

        await sendNotificationBatch(activeClaimers, "cost_changed", POST_ID, {
            old_cost: "30",
            new_cost: "20",
        });

        const invokedUserIds = invoke.mock.calls.map(
            (call) => (call[1] as { body: { user_id: string } }).body.user_id,
        );

        expect(invokedUserIds).toContain(CLAIMER_A);
        expect(invokedUserIds).toContain(CLAIMER_B);
        expect(invokedUserIds).toContain(CLAIMER_D);
        expect(invokedUserIds).not.toContain(CLAIMER_C);
    });
});

// ---------------------------------------------------------------------------
// N8 — price_drop notifications
// ---------------------------------------------------------------------------

describe("N8 — price_drop", () => {
    it("notifies prior viewers", async () => {
        const viewers = [VIEWER_X, VIEWER_Y];
        const recipients = getN8Recipients(viewers, POSTER_ID, new Set());

        await sendNotificationBatch(recipients, "price_drop", POST_ID, {
            new_cost: "10",
        });

        expect(invoke).toHaveBeenCalledTimes(2);

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: VIEWER_X,
                notification_type: "price_drop",
                post_id: POST_ID,
                data: { new_cost: "10" },
            },
        });

        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: VIEWER_Y,
                notification_type: "price_drop",
                post_id: POST_ID,
                data: { new_cost: "10" },
            },
        });
    });

    it("does not notify the poster", async () => {
        const viewers = [POSTER_ID, VIEWER_X, VIEWER_Y];
        const recipients = getN8Recipients(viewers, POSTER_ID, new Set());

        expect(recipients).not.toContain(POSTER_ID);
        expect(recipients).toEqual([VIEWER_X, VIEWER_Y]);

        await sendNotificationBatch(recipients, "price_drop", POST_ID, {
            new_cost: "10",
        });

        const invokedUserIds = invoke.mock.calls.map(
            (call) => (call[1] as { body: { user_id: string } }).body.user_id,
        );

        expect(invokedUserIds).not.toContain(POSTER_ID);
    });

    it("does not double-notify active claimers", async () => {
        // Viewers include active claimers who already got N5
        const viewers = [VIEWER_X, CLAIMER_A, CLAIMER_B, VIEWER_Y];
        const recipients = getN8Recipients(viewers, POSTER_ID, ACTIVE_CLAIMER_IDS);

        expect(recipients).toEqual([VIEWER_X, VIEWER_Y]);
        expect(recipients).not.toContain(CLAIMER_A);
        expect(recipients).not.toContain(CLAIMER_B);

        await sendNotificationBatch(recipients, "price_drop", POST_ID, {
            new_cost: "10",
        });

        expect(invoke).toHaveBeenCalledTimes(2);
    });
});

// ---------------------------------------------------------------------------
// notify_me watchers
// ---------------------------------------------------------------------------

describe("price_drop — notify_me watchers", () => {
    it("notifies watchers via sendNotificationBatch", async () => {
        const watchers = [WATCHER_W];
        const recipients = getN8Recipients(watchers, POSTER_ID, ACTIVE_CLAIMER_IDS);

        await sendNotificationBatch(recipients, "price_drop", POST_ID, {
            new_cost: "10",
        });

        expect(invoke).toHaveBeenCalledOnce();
        expect(invoke).toHaveBeenCalledWith("send-notification", {
            body: {
                user_id: WATCHER_W,
                notification_type: "price_drop",
                post_id: POST_ID,
                data: { new_cost: "10" },
            },
        });
    });
});

// ---------------------------------------------------------------------------
// Edge case: no recipients at all
// ---------------------------------------------------------------------------

describe("discount with no viewers, no claimers, no watchers", () => {
    it("succeeds silently with no notifications sent", async () => {
        // N5 — no active claimers
        await sendNotificationBatch([], "cost_changed", POST_ID, {
            old_cost: "30",
            new_cost: "20",
        });

        // N8 — no viewers
        const viewerRecipients = getN8Recipients([], POSTER_ID, new Set());
        await sendNotificationBatch(viewerRecipients, "price_drop", POST_ID, {
            new_cost: "20",
        });

        // N8 — no watchers
        const watcherRecipients = getN8Recipients([], POSTER_ID, new Set());
        await sendNotificationBatch(watcherRecipients, "price_drop", POST_ID, {
            new_cost: "20",
        });

        expect(invoke).not.toHaveBeenCalled();
    });
});
