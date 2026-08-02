import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { supabase } from "@/lib/supabase";
import {
    postAffectsViewer,
    useRealtimePosts,
    REFETCH_DEBOUNCE_MS,
    type PostChangeRow,
} from "@/hooks/use-realtime-posts";

// ---------------------------------------------------------------------------
// These exercise the real subscription the feed uses. An earlier version of
// this file rendered a stand-in component that applied realtime payloads to
// local state — the feed has never done that (it refetches through RPCs), so
// those tests passed no matter how the subscription behaved.
//
// The debounce/visibility rules live in feed-realtime-scheduler.test.ts. Here
// we cover the wiring: which payloads reach the scheduler, how much work each
// one asks for, and that the channel is opened once and cleaned up.
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
    supabase: { channel: vi.fn(), removeChannel: vi.fn() },
}));

type ChangePayload = { new?: PostChangeRow; old?: PostChangeRow };
type ChangeHandler = (payload: ChangePayload) => void;

const VIEWER = "viewer-1";
const OTHER = "author-2";

describe("postAffectsViewer", () => {
    const own = new Set(["own-post"]);
    const claimed = new Set(["claimed-post"]);

    it("is true for a post the viewer authored", () => {
        expect(postAffectsViewer({ id: "p1", author_id: VIEWER }, VIEWER, own, claimed)).toBe(true);
    });

    it("is true for a post the viewer authored even when not yet in the id sets", () => {
        // A brand-new post of the viewer's arrives before myPosts has refetched.
        expect(postAffectsViewer({ id: "brand-new", author_id: VIEWER }, VIEWER, own, claimed)).toBe(true);
    });

    it("is true for a post the viewer claimed", () => {
        expect(postAffectsViewer({ id: "claimed-post", author_id: OTHER }, VIEWER, own, claimed)).toBe(true);
    });

    it("is true for the viewer's own post identified by id alone", () => {
        // DELETE payloads carry only the primary key.
        expect(postAffectsViewer({ id: "own-post" }, VIEWER, own, claimed)).toBe(true);
    });

    it("is false for an unrelated post — the common case", () => {
        expect(postAffectsViewer({ id: "stranger", author_id: OTHER }, VIEWER, own, claimed)).toBe(false);
    });

    it("is true for an unidentifiable row rather than leaving a banner stale", () => {
        expect(postAffectsViewer(null, VIEWER, own, claimed)).toBe(true);
        expect(postAffectsViewer({}, VIEWER, own, claimed)).toBe(true);
    });

    it("does not match an absent author against an absent viewer", () => {
        // Signed out, on a DELETE payload: undefined === undefined must not read
        // as "this is the viewer's post" and refetch for every session.
        expect(postAffectsViewer({ id: "stranger" }, undefined, new Set(), new Set())).toBe(false);
    });
});

describe("useRealtimePosts", () => {
    let handler: ChangeHandler | null = null;
    let refetchFeed: ReturnType<typeof vi.fn>;
    let refetchMine: ReturnType<typeof vi.fn>;
    let subscribe: ReturnType<typeof vi.fn>;

    const ownPostIds = new Set(["own-post"]);
    const claimedPostIds = new Set(["claimed-post"]);
    const affectsViewer = (row: PostChangeRow | null) =>
        postAffectsViewer(row, VIEWER, ownPostIds, claimedPostIds);

    const mount = () =>
        renderHook(() => useRealtimePosts({ refetchFeed, refetchMine, affectsViewer }));

    /** Deliver a change and let the debounce window close. */
    const emit = (payload: ChangePayload) => {
        act(() => {
            handler?.(payload);
            vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS);
        });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        handler = null;
        refetchFeed = vi.fn();
        refetchMine = vi.fn();
        subscribe = vi.fn();

        const channel = {
            on: vi.fn((_event: string, _filter: unknown, cb: ChangeHandler) => {
                handler = cb;
                return channel;
            }),
            subscribe,
        };
        // Reset before stubbing: these are module-level mocks, so call counts
        // carry across tests otherwise.
        vi.mocked(supabase.channel).mockReset();
        vi.mocked(supabase.channel).mockReturnValue(channel as never);
        vi.mocked(supabase.removeChannel).mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("opens and subscribes to a single posts channel", () => {
        mount();
        expect(supabase.channel).toHaveBeenCalledTimes(1);
        expect(supabase.channel).toHaveBeenCalledWith("feed-posts");
        expect(subscribe).toHaveBeenCalledTimes(1);
    });

    it("refetches the feed only for an unrelated post", () => {
        mount();
        emit({ new: { id: "stranger", author_id: OTHER } });

        expect(refetchFeed).toHaveBeenCalledTimes(1);
        expect(refetchMine).not.toHaveBeenCalled();
    });

    it("refetches both halves for the viewer's own post", () => {
        mount();
        emit({ new: { id: "own-post", author_id: VIEWER } });

        expect(refetchFeed).toHaveBeenCalledTimes(1);
        expect(refetchMine).toHaveBeenCalledTimes(1);
    });

    it("refetches both halves for a post the viewer claimed", () => {
        mount();
        emit({ new: { id: "claimed-post", author_id: OTHER } });

        expect(refetchMine).toHaveBeenCalledTimes(1);
    });

    it("reads the row from `old` when a payload has no `new`", () => {
        mount();
        // A hard DELETE carries only `old`; reading `new` alone would treat every
        // deletion as unidentifiable and refetch both halves on every client.
        emit({ old: { id: "stranger", author_id: OTHER } });

        expect(refetchFeed).toHaveBeenCalledTimes(1);
        expect(refetchMine).not.toHaveBeenCalled();
    });

    it("does not reopen the channel when the callbacks change identity", () => {
        const { rerender } = renderHook(
            ({ id }) =>
                useRealtimePosts({
                    // Fresh function identities on every render, as the feed
                    // produces whenever its state changes.
                    refetchFeed: () => refetchFeed(id),
                    refetchMine: () => refetchMine(id),
                    affectsViewer,
                }),
            { initialProps: { id: 1 } },
        );

        rerender({ id: 2 });
        rerender({ id: 3 });

        expect(supabase.channel).toHaveBeenCalledTimes(1);
        expect(supabase.removeChannel).not.toHaveBeenCalled();
    });

    it("calls the latest callbacks, not the ones captured at subscribe time", () => {
        const { rerender } = renderHook(
            ({ id }) =>
                useRealtimePosts({
                    refetchFeed: () => refetchFeed(id),
                    refetchMine: () => refetchMine(id),
                    affectsViewer,
                }),
            { initialProps: { id: 1 } },
        );

        rerender({ id: 2 });
        emit({ new: { id: "stranger", author_id: OTHER } });

        expect(refetchFeed).toHaveBeenCalledWith(2);
    });

    it("removes the channel on unmount", () => {
        const { unmount } = mount();
        unmount();
        expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    });

    it("does not refetch after unmount", () => {
        const { unmount } = mount();

        act(() => {
            handler?.({ new: { id: "stranger", author_id: OTHER } });
        });
        unmount();
        act(() => {
            vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS * 5);
        });

        expect(refetchFeed).not.toHaveBeenCalled();
    });

    it("does no work while the tab is hidden, then catches up when it returns", () => {
        const visibility = vi.spyOn(document, "visibilityState", "get");
        mount();

        visibility.mockReturnValue("hidden");
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
            handler?.({ new: { id: "stranger", author_id: OTHER } });
            vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS * 5);
        });
        expect(refetchFeed).not.toHaveBeenCalled();

        visibility.mockReturnValue("visible");
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(refetchFeed).toHaveBeenCalledTimes(1);

        visibility.mockRestore();
    });
});
