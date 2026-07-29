import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification, type NotificationType } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

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
 * Which row each notification type hangs off.
 *
 * This is the whole of the client's remaining responsibility: name a type and
 * point at the right kind of row. The server rejects a claim-anchored type with
 * no `claim_id` (400) and derives recipients from whichever row it gets, so
 * pointing a type at the wrong reference is the one wiring mistake that still
 * has teeth — and it is invisible until a notification silently goes nowhere.
 *
 * These replace a suite whose cases ("does NOT notify rejected claimers",
 * "does not notify the poster themselves") described recipient-selection rules
 * that the browser no longer performs. Those rules moved to
 * `_shared/notification-authz.ts`; the list logic in them is covered by
 * notification-recipients.test.ts, and the status filters are query-level.
 */
const CLAIM_ANCHORED: NotificationType[] = [
    "claim_submitted",
    "claim_approved",
    "claim_rejected",
    "claimer_backed_out",
    "claimer_cancelled",
    "connection_request",
];

const POST_ANCHORED: NotificationType[] = [
    "cost_changed",
    "price_drop",
    "spot_reopened",
    "friend_new_post",
    "connection_closed",
];

describe("notification trigger wiring", () => {
    it.each(CLAIM_ANCHORED)("%s is dispatched against a claim", async (type) => {
        await sendNotification({ notification_type: type, claim_id: "claim-1" });

        const body = invoke.mock.calls[0][1]?.body as Record<string, unknown>;
        expect(body.notification_type).toBe(type);
        expect(body.claim_id).toBe("claim-1");
    });

    it.each(POST_ANCHORED)("%s is dispatched against a post", async (type) => {
        await sendNotification({ notification_type: type, post_id: "post-1" });

        const body = invoke.mock.calls[0][1]?.body as Record<string, unknown>;
        expect(body.notification_type).toBe(type);
        expect(body.post_id).toBe("post-1");
    });

    it("sends one request per fan-out, not one per recipient", async () => {
        // The server resolves followers/watchers/claimers now. A client-side loop
        // here would mean the recipient list was being chosen in the browser again.
        await sendNotification({ notification_type: "friend_new_post", post_id: "post-2" });

        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it("dispatch failure does not block the triggering action", async () => {
        invoke.mockResolvedValueOnce({ data: null, error: { message: "edge function down" } } as never);

        await expect(
            sendNotification({ notification_type: "claim_submitted", claim_id: "claim-9" }),
        ).resolves.toBeNull();
    });
});
