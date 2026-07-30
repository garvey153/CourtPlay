import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification } from "@/lib/notifications";
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
    invoke.mockResolvedValue({ data: { recipients: 2, delivered: 2 }, error: null } as never);
});

const bodyOf = (call: number) => invoke.mock.calls[call][1]?.body as Record<string, unknown>;

/**
 * The two price notifications are the only ones that still carry a value from
 * the client, so they get their own tests.
 *
 * The edit writes `posts.cost` in place and never touches `original_cost`, so by
 * the time the server looks the previous price is gone — `old_cost` has to
 * travel. `new_cost` does not: the server reads it off the post, which is what
 * keeps the number in the email honest. Recipients are derived server-side for
 * both (active claimers for a cost change, prior viewers minus those claimers
 * for a price drop), so the browser no longer enumerates anyone.
 */
describe("cost_changed", () => {
    it("carries only the previous price, never the new one", async () => {
        await sendNotification({
            notification_type: "cost_changed",
            post_id: "post-1",
            old_cost: "40.00",
        });

        expect(bodyOf(0)).toEqual({
            notification_type: "cost_changed",
            post_id: "post-1",
            old_cost: "40.00",
        });
        expect(bodyOf(0)).not.toHaveProperty("new_cost");
    });

    it("does not enumerate claimers in the browser", async () => {
        await sendNotification({ notification_type: "cost_changed", post_id: "post-1", old_cost: "40.00" });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(bodyOf(0)).not.toHaveProperty("user_id");
    });
});

describe("price_drop", () => {
    it("carries only the previous price", async () => {
        await sendNotification({
            notification_type: "price_drop",
            post_id: "post-2",
            old_cost: "40.00",
        });

        expect(bodyOf(0)).toEqual({
            notification_type: "price_drop",
            post_id: "post-2",
            old_cost: "40.00",
        });
    });

    it("does not enumerate viewers in the browser", async () => {
        await sendNotification({ notification_type: "price_drop", post_id: "post-2", old_cost: "40.00" });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(bodyOf(0)).not.toHaveProperty("user_id");
    });

    // A drop is both a cost change and a drop, so the edit fires both types. The
    // server is responsible for keeping a live claimer out of the second one.
    it("is dispatched alongside cost_changed as two separate requests", async () => {
        await sendNotification({ notification_type: "cost_changed", post_id: "post-3", old_cost: "40.00" });
        await sendNotification({ notification_type: "price_drop", post_id: "post-3", old_cost: "40.00" });

        expect(invoke).toHaveBeenCalledTimes(2);
        expect(bodyOf(0).notification_type).toBe("cost_changed");
        expect(bodyOf(1).notification_type).toBe("price_drop");
    });
});
