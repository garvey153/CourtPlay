import { describe, expect, it } from "vitest";
import { excluding, newPostRecipients, others } from "../../supabase/functions/_shared/notification-recipients.ts";

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

/**
 * The private case points the OPPOSITE way along `follows` from the public one,
 * and getting it backwards notifies a plausible-looking set of the wrong
 * people. Both directions are asserted separately for that reason.
 */
describe("newPostRecipients", () => {
    const base = {
        followers: ["follower"],
        following: ["followed"],
        groupMembers: ["groupmate"],
        posterId: "poster",
        allFollowing: false,
    };

    it("public: goes to the poster's followers", () => {
        expect(newPostRecipients({ ...base, isPrivate: false })).toEqual(["follower"]);
    });

    it("public: ignores the audience fields entirely", () => {
        expect(newPostRecipients({ ...base, isPrivate: false, allFollowing: true })).toEqual(["follower"]);
    });

    it("private: never reaches a follower who is outside the audience", () => {
        const got = newPostRecipients({ ...base, isPrivate: true, allFollowing: true });
        expect(got).not.toContain("follower");
    });

    it("private + all-following: goes to people the POSTER follows, not to their followers", () => {
        expect(newPostRecipients({ ...base, isPrivate: true, allFollowing: true, groupMembers: [] })).toEqual(["followed"]);
    });

    it("private: group members hear even though they don't follow the poster", () => {
        expect(newPostRecipients({ ...base, isPrivate: true, allFollowing: false })).toEqual(["groupmate"]);
    });

    it("private: without all-following, the followed player is not in the audience", () => {
        expect(newPostRecipients({ ...base, isPrivate: true, allFollowing: false })).not.toContain("followed");
    });

    it("private: someone both followed and in a group hears exactly once", () => {
        const got = newPostRecipients({
            ...base,
            isPrivate: true,
            allFollowing: true,
            following: ["both"],
            groupMembers: ["both"],
        });
        expect(got).toEqual(["both"]);
    });

    it("private with nothing selected reaches nobody — it fails closed", () => {
        expect(newPostRecipients({ ...base, isPrivate: true, allFollowing: false, groupMembers: [] })).toEqual([]);
    });

    it("never notifies the poster, even when they're in one of their own groups", () => {
        const got = newPostRecipients({ ...base, isPrivate: true, groupMembers: ["poster", "groupmate"] });
        expect(got).toEqual(["groupmate"]);
    });
});
