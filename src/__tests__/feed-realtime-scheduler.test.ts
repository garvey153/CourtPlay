import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRefetchScheduler, HIDDEN_STALE_MS, REFETCH_DEBOUNCE_MS } from "@/hooks/use-realtime-posts";

// ---------------------------------------------------------------------------
// The feed subscribes every open session to every change on `posts`, so one new
// post reaches every connected client at once. These cover the three things
// that keep that fanout from scaling with users x activity: burst coalescing,
// skipping the banner RPCs for other people's posts, and doing nothing at all
// while the tab is hidden.
// ---------------------------------------------------------------------------

describe("feed realtime refetch scheduler", () => {
    let refetchFeed: ReturnType<typeof vi.fn>;
    let refetchMine: ReturnType<typeof vi.fn>;

    const makeScheduler = () => createRefetchScheduler({ refetchFeed, refetchMine });

    beforeEach(() => {
        // Fakes Date as well as the timers, which the hidden-tab staleness
        // window is measured with.
        vi.useFakeTimers();
        refetchFeed = vi.fn();
        refetchMine = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("collapses a burst of changes into a single refetch", () => {
        const scheduler = makeScheduler();

        for (let i = 0; i < 10; i++) {
            scheduler.schedule({ feed: true });
            vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS / 10);
        }
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS);

        expect(refetchFeed).toHaveBeenCalledTimes(1);
    });

    it("queues one timer for a burst rather than one per change", () => {
        const scheduler = makeScheduler();

        // Clearing `pending` on flush would hold the refetch count at 1 on its
        // own, so assert the timers too — otherwise a burst still costs a timer
        // per event and only looks coalesced.
        for (let i = 0; i < 10; i++) scheduler.schedule({ feed: true });

        expect(vi.getTimerCount()).toBe(1);
    });

    it("does not refetch before the debounce window closes", () => {
        const scheduler = makeScheduler();

        scheduler.schedule({ feed: true });
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS - 1);
        expect(refetchFeed).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(refetchFeed).toHaveBeenCalledTimes(1);
    });

    it("skips the banner refetch for a change that does not concern the viewer", () => {
        const scheduler = makeScheduler();

        scheduler.schedule({ feed: true, mine: false });
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS);

        expect(refetchFeed).toHaveBeenCalledTimes(1);
        expect(refetchMine).not.toHaveBeenCalled();
    });

    it("refetches both halves when one event in the burst concerns the viewer", () => {
        const scheduler = makeScheduler();

        scheduler.schedule({ feed: true, mine: false });
        scheduler.schedule({ feed: true, mine: true });
        scheduler.schedule({ feed: true, mine: false });
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS);

        expect(refetchFeed).toHaveBeenCalledTimes(1);
        expect(refetchMine).toHaveBeenCalledTimes(1);
    });

    it("does no work at all while the tab is hidden", () => {
        const scheduler = makeScheduler();
        scheduler.setVisible(false);

        for (let i = 0; i < 25; i++) scheduler.schedule({ feed: true, mine: true });
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS * 10);

        expect(refetchFeed).not.toHaveBeenCalled();
        expect(refetchMine).not.toHaveBeenCalled();
        expect(scheduler.pending()).toEqual({ feed: true, mine: true });
    });

    it("drains queued work immediately when the tab comes back", () => {
        const scheduler = makeScheduler();
        scheduler.setVisible(false);
        scheduler.schedule({ feed: true, mine: false });

        scheduler.setVisible(true);

        // Immediate, not debounced — the user is looking at a stale feed now.
        expect(refetchFeed).toHaveBeenCalledTimes(1);
        expect(scheduler.pending()).toEqual({ feed: false, mine: false });
    });

    it("refetches after a long hidden stretch even with nothing queued", () => {
        const scheduler = makeScheduler();
        scheduler.setVisible(false);

        // Nothing arrived — but a socket suspended this long probably dropped
        // events rather than delivering none.
        vi.advanceTimersByTime(HIDDEN_STALE_MS + 1);
        scheduler.setVisible(true);

        expect(refetchFeed).toHaveBeenCalledTimes(1);
        expect(refetchMine).toHaveBeenCalledTimes(1);
    });

    it("does not refetch on a brief tab switch with nothing queued", () => {
        const scheduler = makeScheduler();
        scheduler.setVisible(false);

        vi.advanceTimersByTime(1000);
        scheduler.setVisible(true);

        expect(refetchFeed).not.toHaveBeenCalled();
        expect(refetchMine).not.toHaveBeenCalled();
    });

    it("cancel drops a pending refetch", () => {
        const scheduler = makeScheduler();

        scheduler.schedule({ feed: true });
        scheduler.cancel();
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS * 5);

        expect(refetchFeed).not.toHaveBeenCalled();
    });

    it("starts a fresh window for changes arriving after a flush", () => {
        const scheduler = makeScheduler();

        scheduler.schedule({ feed: true });
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS);
        expect(refetchFeed).toHaveBeenCalledTimes(1);

        scheduler.schedule({ feed: true });
        vi.advanceTimersByTime(REFETCH_DEBOUNCE_MS);
        expect(refetchFeed).toHaveBeenCalledTimes(2);
    });
});
