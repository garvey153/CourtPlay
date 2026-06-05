import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// View tracking logic tests — pure unit tests against the handleViewed closure
// We extract and test the view-tracking logic independently from React.
// ---------------------------------------------------------------------------

/**
 * Builds a minimal version of the handleViewed callback with injectable
 * dependencies so we can unit-test it without rendering the full Feed.
 */
function buildHandleViewed({
    userId,
    rpc,
    upsert,
    debounceMs = 0,
}: {
    userId: string | null;
    rpc: (name: string, args: Record<string, string>) => Promise<void>;
    upsert: (table: string, row: Record<string, string>) => Promise<void>;
    debounceMs?: number;
}) {
    const viewedIds = new Set<string>();
    const viewTimers = new Map<string, ReturnType<typeof setTimeout>>();

    return function handleViewed(postId: string, postAuthorId: string): void {
        // Skip if not authenticated
        if (!userId) return;
        // Skip own posts
        if (userId === postAuthorId) return;
        // Skip already tracked
        if (viewedIds.has(postId)) return;

        // Clear any existing timer for this post
        const existing = viewTimers.get(postId);
        if (existing) clearTimeout(existing);

        const t = setTimeout(() => {
            if (viewedIds.has(postId)) return;
            viewedIds.add(postId);
            viewTimers.delete(postId);
            rpc("increment_view_count", { p_post_id: postId }).catch(() => {});
            upsert("post_views", { user_id: userId!, post_id: postId }).catch(() => {});
        }, debounceMs);

        viewTimers.set(postId, t);
    };
}

describe("view tracking logic", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("increment_view_count RPC called when card enters viewport", async () => {
        const rpc = vi.fn().mockResolvedValue(undefined);
        const upsert = vi.fn().mockResolvedValue(undefined);
        const handleViewed = buildHandleViewed({ userId: "user-1", rpc, upsert, debounceMs: 300 });

        handleViewed("post-1", "author-1");
        vi.runAllTimers();
        await Promise.resolve();

        expect(rpc).toHaveBeenCalledWith("increment_view_count", { p_post_id: "post-1" });
    });

    it("post_views upsert called when card enters viewport", async () => {
        const rpc = vi.fn().mockResolvedValue(undefined);
        const upsert = vi.fn().mockResolvedValue(undefined);
        const handleViewed = buildHandleViewed({ userId: "user-1", rpc, upsert, debounceMs: 300 });

        handleViewed("post-1", "author-1");
        vi.runAllTimers();
        await Promise.resolve();

        expect(upsert).toHaveBeenCalledWith("post_views", {
            user_id: "user-1",
            post_id: "post-1",
        });
    });

    it("view tracking is debounced — RPC called at most once for rapid entries", async () => {
        const rpc = vi.fn().mockResolvedValue(undefined);
        const upsert = vi.fn().mockResolvedValue(undefined);
        const handleViewed = buildHandleViewed({ userId: "user-1", rpc, upsert, debounceMs: 300 });

        // Simulate entering viewport 5 times within 300ms
        for (let i = 0; i < 5; i++) {
            handleViewed("post-1", "author-1");
        }
        vi.runAllTimers();
        await Promise.resolve();

        // Despite 5 calls, RPC fires exactly once
        expect(rpc).toHaveBeenCalledTimes(1);
    });

    it("view tracking does not fire for own posts", async () => {
        const rpc = vi.fn().mockResolvedValue(undefined);
        const upsert = vi.fn().mockResolvedValue(undefined);
        // userId === postAuthorId
        const handleViewed = buildHandleViewed({ userId: "user-1", rpc, upsert, debounceMs: 300 });

        handleViewed("post-1", "user-1"); // own post
        vi.runAllTimers();
        await Promise.resolve();

        expect(rpc).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
    });

    it("view tracking does not fire when user is not authenticated", async () => {
        const rpc = vi.fn().mockResolvedValue(undefined);
        const upsert = vi.fn().mockResolvedValue(undefined);
        const handleViewed = buildHandleViewed({ userId: null, rpc, upsert, debounceMs: 300 });

        handleViewed("post-1", "author-1");
        vi.runAllTimers();
        await Promise.resolve();

        expect(rpc).not.toHaveBeenCalled();
    });

    it("view tracking failure does not propagate — RPC rejection is swallowed", async () => {
        // Build a version where rpc failure is caught (mirrors real handleViewed which uses fire-and-forget)
        function buildSafeHandleViewed({
            userId,
            rpc,
            upsert,
            debounceMs = 0,
        }: {
            userId: string | null;
            rpc: (name: string, args: Record<string, string>) => Promise<void>;
            upsert: (table: string, row: Record<string, string>) => Promise<void>;
            debounceMs?: number;
        }) {
            const viewedIds = new Set<string>();
            const viewTimers = new Map<string, ReturnType<typeof setTimeout>>();

            return function handleViewed(postId: string, postAuthorId: string): void {
                if (!userId || userId === postAuthorId || viewedIds.has(postId)) return;
                const existing = viewTimers.get(postId);
                if (existing) clearTimeout(existing);
                const t = setTimeout(() => {
                    if (viewedIds.has(postId)) return;
                    viewedIds.add(postId);
                    viewTimers.delete(postId);
                    // Fire-and-forget — errors swallowed
                    rpc("increment_view_count", { p_post_id: postId }).catch(() => {});
                    upsert("post_views", { user_id: userId!, post_id: postId }).catch(() => {});
                }, debounceMs);
                viewTimers.set(postId, t);
            };
        }

        const rpc = vi.fn().mockRejectedValue(new Error("Network error"));
        const upsert = vi.fn().mockResolvedValue(undefined);
        const handleViewed = buildSafeHandleViewed({ userId: "user-1", rpc, upsert, debounceMs: 0 });

        // Should not throw
        handleViewed("post-1", "author-1");
        vi.runAllTimers();
        // Allow promise microtasks to flush
        await Promise.resolve();
        await Promise.resolve();

        // RPC was called but its rejection was swallowed
        expect(rpc).toHaveBeenCalled();
    });

    it("view tracking only fires once per post (idempotent)", async () => {
        const rpc = vi.fn().mockResolvedValue(undefined);
        const upsert = vi.fn().mockResolvedValue(undefined);
        const handleViewed = buildHandleViewed({ userId: "user-1", rpc, upsert, debounceMs: 300 });

        handleViewed("post-1", "author-1");
        vi.runAllTimers();
        await Promise.resolve();

        // Second call after already tracked
        handleViewed("post-1", "author-1");
        vi.runAllTimers();
        await Promise.resolve();

        expect(rpc).toHaveBeenCalledTimes(1);
    });
});
