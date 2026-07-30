import { describe, expect, it } from "vitest";
import { alreadyNotified } from "../../supabase/functions/_shared/notification-dedupe.ts";

/**
 * A stub shaped like the bit of the Supabase client this touches. It records the
 * `.eq()` filters so the tests can assert which column the query was anchored
 * on, and returns whatever result the case needs from `.limit()`.
 */
function stubSupabase(result: { data?: unknown[]; error?: unknown }) {
    const filters: Record<string, unknown> = {};
    const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
        },
        limit: () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }),
    };
    return { client: { from: () => chain }, filters };
}

describe("alreadyNotified", () => {
    it("is true when a row exists", async () => {
        const { client } = stubSupabase({ data: [{ id: "n1" }] });

        await expect(alreadyNotified(client, { userId: "u1", type: "game_reminder", postId: "p1" }))
            .resolves.toBe(true);
    });

    it("is false when no row exists", async () => {
        const { client } = stubSupabase({ data: [] });

        await expect(alreadyNotified(client, { userId: "u1", type: "game_reminder", postId: "p1" }))
            .resolves.toBe(false);
    });

    /**
     * The bug this replaces. send-notification writes one row per channel, so a
     * recipient who got both push and email has two — and `maybeSingle()` errors
     * on more than one row, handing back a null `data` that reads as "not sent".
     * The job then re-sent on every run, but only for users who had enabled push.
     */
    it("is true when MULTIPLE rows exist — one per delivered channel", async () => {
        const { client } = stubSupabase({ data: [{ id: "push-row" }, { id: "email-row" }] });

        await expect(alreadyNotified(client, { userId: "u1", type: "nudge_no_response", claimId: "c1" }))
            .resolves.toBe(true);
    });

    // A failed lookup should let the send through. A duplicate notification is a
    // smaller harm than one that silently never arrives.
    it("fails open when the query errors", async () => {
        const { client } = stubSupabase({ error: { message: "boom" } });

        await expect(alreadyNotified(client, { userId: "u1", type: "game_reminder", postId: "p1" }))
            .resolves.toBe(false);
    });

    it("anchors on post_id for the post-based jobs", async () => {
        const { client, filters } = stubSupabase({ data: [] });

        await alreadyNotified(client, { userId: "u1", type: "friend_expiry", postId: "p9" });

        expect(filters).toEqual({ user_id: "u1", type: "friend_expiry", post_id: "p9" });
        expect(filters).not.toHaveProperty("claim_id");
    });

    it("anchors on claim_id for the claim-based job", async () => {
        const { client, filters } = stubSupabase({ data: [] });

        await alreadyNotified(client, { userId: "u2", type: "nudge_no_response", claimId: "c9" });

        expect(filters).toEqual({ user_id: "u2", type: "nudge_no_response", claim_id: "c9" });
        expect(filters).not.toHaveProperty("post_id");
    });
});
