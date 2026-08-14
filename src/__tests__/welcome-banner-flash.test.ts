import { beforeEach, describe, expect, it } from "vitest";
import { readWelcomeSession, shouldShowWelcome } from "@/pages/feed";

/**
 * The welcome card appeared for a moment on every navigation to the feed, then
 * vanished, for users who already had posts.
 *
 * The gate was `!dismissed && !loading && myPosts.length === 0`, but `loading`
 * only covers get_feed. The "mine" RPCs (get_my_posts_with_claims and
 * get_my_claims_with_posts) run in a separate function with no loading flag of
 * their own, and there are two of them, so they routinely settle after get_feed.
 * In that window myPosts is still [] — which means "not fetched yet", not "you
 * have no posts" — and the card rendered on the assumption of the latter.
 *
 * Same shape as the push banner flash: a consumer unable to distinguish "not
 * known yet" from a known-negative. See push-banner-flash.test.tsx.
 */

const base = { dismissed: false, feedLoading: false, myPostsLoaded: true, myPostCount: 0, firstSession: true };

describe("shouldShowWelcome", () => {
    it("does NOT show while the 'mine' RPCs are still in flight — the flash", () => {
        // get_feed has come back, the mine RPCs have not. myPostCount is 0 only
        // because nothing has been fetched. This returned true before the fix.
        expect(shouldShowWelcome({ ...base, myPostsLoaded: false })).toBe(false);
    });

    it("still does not show mid-flight even once the feed has rendered posts", () => {
        expect(shouldShowWelcome({ ...base, feedLoading: false, myPostsLoaded: false, myPostCount: 0 })).toBe(false);
    });

    it("shows for a genuine first-run user once the mine RPCs confirm zero posts", () => {
        expect(shouldShowWelcome(base)).toBe(true);
    });

    it("does not show once the user has posts", () => {
        expect(shouldShowWelcome({ ...base, myPostCount: 1 })).toBe(false);
    });

    it("does not show while the feed itself is loading", () => {
        expect(shouldShowWelcome({ ...base, feedLoading: true })).toBe(false);
    });

    it("does not show when dismissed, whatever else is true", () => {
        expect(shouldShowWelcome({ ...base, dismissed: true })).toBe(false);
        expect(
            shouldShowWelcome({ dismissed: true, feedLoading: false, myPostsLoaded: true, myPostCount: 0, firstSession: true }),
        ).toBe(false);
    });

    it("never shows before the mine RPCs settle, for any other combination", () => {
        for (const dismissed of [true, false]) {
            for (const feedLoading of [true, false]) {
                for (const myPostCount of [0, 3]) {
                    expect(
                        shouldShowWelcome({ dismissed, feedLoading, myPostsLoaded: false, myPostCount, firstSession: true }),
                    ).toBe(false);
                }
            }
        }
    });
});

/**
 * The card is a first-session thing: it greets you, then goes away by itself.
 *
 * "Session" is sessionStorage — cleared when the tab closes, survives a reload.
 * localStorage remembers that a first session happened at all, which is how the
 * second one tells "still in it" from "it already went by".
 */
describe("readWelcomeSession", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("is the first session for a brand-new visitor", () => {
        expect(readWelcomeSession()).toBe(true);
    });

    it("stays the first session across a reload", () => {
        expect(readWelcomeSession()).toBe(true);
        // A reload keeps sessionStorage and re-runs the read.
        expect(readWelcomeSession()).toBe(true);
    });

    it("is over once the tab has been closed and reopened", () => {
        expect(readWelcomeSession()).toBe(true);
        sessionStorage.clear(); // what closing the tab does
        expect(readWelcomeSession()).toBe(false);
    });

    it("stays over, without re-deciding it every time", () => {
        readWelcomeSession();
        sessionStorage.clear();
        readWelcomeSession();
        sessionStorage.clear();
        expect(readWelcomeSession()).toBe(false);
    });

    it("shows rather than suppresses when storage is unavailable", () => {
        const getItem = Storage.prototype.getItem;
        Storage.prototype.getItem = () => {
            throw new Error("private mode");
        };
        try {
            expect(readWelcomeSession()).toBe(true);
        } finally {
            Storage.prototype.getItem = getItem;
        }
    });
});

describe("shouldShowWelcome after the first session", () => {
    it("does not show, whatever else is true", () => {
        expect(shouldShowWelcome({ ...base, firstSession: false })).toBe(false);
    });
});
