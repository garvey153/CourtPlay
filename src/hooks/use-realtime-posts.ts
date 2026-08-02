import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Every open session subscribes to every change on `posts`, because the feed is
// global — there is no server-side filter that narrows it without also hiding
// the removals (a claimed or deleted post leaving the feed is exactly what the
// other clients need to see). So the fanout itself is inherent; what this
// module controls is how much work each client does per event.
//
// Three levers, in order of how much they save:
//   1. A hidden tab does nothing at all until it is looked at again.
//   2. A change to somebody else's post refetches the feed only — the banners
//      it would otherwise refresh cannot have changed.
//   3. A burst of changes collapses into a single refetch.
export const REFETCH_DEBOUNCE_MS = 1000;
// A tab hidden longer than this has likely had its realtime socket dropped
// (mobile suspends backgrounded PWAs), so events were missed rather than merely
// deferred — refetch on the way back in even with nothing queued.
export const HIDDEN_STALE_MS = 30_000;

/** The subset of a `posts` row the change handler needs to make its decision. */
export interface PostChangeRow {
    id?: string;
    author_id?: string;
}

export interface SchedulerOptions {
    refetchFeed: () => void;
    /** Refetches the viewer's own posts and claims — what drives the banners. */
    refetchMine: () => void;
    debounceMs?: number;
    hiddenStaleMs?: number;
}

export interface RefetchScheduler {
    /** Queue work for an incoming change. No-op beyond queueing while hidden. */
    schedule(want: { feed?: boolean; mine?: boolean }): void;
    /** Report a visibility transition; draining is decided from it. */
    setVisible(visible: boolean): void;
    /** Drop any pending timer (unmount). */
    cancel(): void;
    /** Test seam: what is currently queued. */
    pending(): { feed: boolean; mine: boolean };
}

/**
 * Framework-free so it can be tested without mounting the feed. Holds no React
 * state on purpose: a re-render must never restart the debounce window or tear
 * down the channel.
 */
export function createRefetchScheduler(opts: SchedulerOptions): RefetchScheduler {
    const debounceMs = opts.debounceMs ?? REFETCH_DEBOUNCE_MS;
    const hiddenStaleMs = opts.hiddenStaleMs ?? HIDDEN_STALE_MS;

    let pending = { feed: false, mine: false };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hiddenSince: number | null = null;

    // Always silent from here: this is a background refresh of a feed already on
    // screen. A non-silent refetch replaced every reader's feed with the loading
    // state whenever anyone, anywhere, touched a post.
    const flush = () => {
        const want = pending;
        pending = { feed: false, mine: false };
        if (want.feed) opts.refetchFeed();
        if (want.mine) opts.refetchMine();
    };

    return {
        schedule(want) {
            if (want.feed) pending.feed = true;
            if (want.mine) pending.mine = true;
            if (hiddenSince !== null) return;
            // Already coalescing — this event joins that window rather than
            // starting a second refetch.
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                flush();
            }, debounceMs);
        },

        setVisible(visible) {
            if (!visible) {
                if (hiddenSince === null) hiddenSince = Date.now();
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                return;
            }
            const hiddenFor = hiddenSince === null ? 0 : Date.now() - hiddenSince;
            hiddenSince = null;
            if (!pending.feed && !pending.mine && hiddenFor < hiddenStaleMs) return;
            // Both halves: while hidden we stopped tracking which events arrived,
            // and a dropped socket means some never did.
            pending = { feed: true, mine: true };
            flush();
        },

        cancel() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        },

        pending() {
            return { ...pending };
        },
    };
}

export interface RealtimePostsOptions {
    refetchFeed: () => void;
    refetchMine: () => void;
    /**
     * Whether a changed post can affect the viewer's banners — their own post,
     * or one they claimed. Read at event time, so it must see current state
     * without the caller having to re-open the channel.
     */
    affectsViewer: (row: PostChangeRow | null) => boolean;
}

/** Opens one `posts` channel for the session and routes changes through the scheduler. */
export function useRealtimePosts({ refetchFeed, refetchMine, affectsViewer }: RealtimePostsOptions) {
    // Latest-callback refs: the channel is opened once and must not be torn down
    // and re-established every time feed state changes.
    const latest = useRef({ refetchFeed, refetchMine, affectsViewer });
    useEffect(() => {
        latest.current = { refetchFeed, refetchMine, affectsViewer };
    }, [refetchFeed, refetchMine, affectsViewer]);

    useEffect(() => {
        const scheduler = createRefetchScheduler({
            refetchFeed: () => latest.current.refetchFeed(),
            refetchMine: () => latest.current.refetchMine(),
        });

        const onVisibilityChange = () => scheduler.setVisible(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", onVisibilityChange);

        const channel = supabase
            .channel("feed-posts")
            .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
                const row = (payload.new ?? payload.old ?? null) as PostChangeRow | null;
                // Unidentifiable row → assume it concerns the viewer rather than
                // leave a banner stale. Soft deletes arrive as UPDATEs, so this
                // is rare.
                const mine = !row?.id || latest.current.affectsViewer(row);
                scheduler.schedule({ feed: true, mine });
            })
            .subscribe();

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            scheduler.cancel();
            supabase.removeChannel(channel);
        };
    }, []);
}
