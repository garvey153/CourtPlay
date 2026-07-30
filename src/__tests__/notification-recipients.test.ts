import { describe, expect, it } from "vitest";
import { excluding, others } from "../../supabase/functions/_shared/notification-recipients.ts";

/**
 * The recipient rules that used to be asserted from the browser.
 *
 * When each trigger site built its own recipient array, cases like "does not
 * notify the poster themselves" and "does not double-notify active claimers"
 * were tested by having the test construct the list and then checking the
 * dispatch helper forwarded it — which verified the helper, not the rule.
 * Now the rules live server-side, and the parts of them that are pure list
 * logic are extracted so they can be tested for real.
 */
describe("others", () => {
    it("removes the actor — nobody is notified about their own action", () => {
        expect(others(["a", "b", "actor"], "actor")).toEqual(["a", "b"]);
    });

    it("deduplicates, so someone who is both a watcher and a follower hears once", () => {
        expect(others(["a", "b", "a"], "actor")).toEqual(["a", "b"]);
    });

    it("drops null and undefined ids from partial joins", () => {
        expect(others(["a", null, undefined, "b"], "actor")).toEqual(["a", "b"]);
    });

    it("returns empty when the actor is the only candidate", () => {
        expect(others(["actor", "actor"], "actor")).toEqual([]);
    });

    it("preserves first-seen order", () => {
        expect(others(["c", "a", "c", "b"], "actor")).toEqual(["c", "a", "b"]);
    });
});

describe("excluding", () => {
    it("keeps a price drop from reaching claimers who get the cost-change notice", () => {
        expect(excluding(["viewer", "claimer"], ["claimer"])).toEqual(["viewer"]);
    });

    it("is a no-op when nothing overlaps", () => {
        expect(excluding(["a", "b"], ["c"])).toEqual(["a", "b"]);
    });

    it("returns empty when every viewer already holds a live claim", () => {
        expect(excluding(["a", "b"], ["a", "b"])).toEqual([]);
    });

    it("accepts a Set, which is how the caller holds the claimer list", () => {
        expect(excluding(["a", "b"], new Set(["b"]))).toEqual(["a"]);
    });
});
