import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useState, useEffect, useCallback } from "react";
import type { FeedPost } from "@/types/feed";

// ---------------------------------------------------------------------------
// We test the real-time subscription behaviour using a minimal feed component
// that mirrors the subscription logic from feed.tsx without Supabase/auth deps.
// ---------------------------------------------------------------------------

type RealTimeEvent = {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: Partial<FeedPost>;
};

/** Minimal feed that mirrors the real-time subscription logic */
function MiniRealTimeFeed({
    initialPosts,
    subscribeToChanges,
}: {
    initialPosts: FeedPost[];
    subscribeToChanges: (cb: (event: RealTimeEvent) => void) => () => void;
}) {
    const [posts, setPosts] = useState<FeedPost[]>(initialPosts);

    useEffect(() => {
        const unsubscribe = subscribeToChanges((event) => {
            if (event.eventType === "INSERT") {
                setPosts((prev) => {
                    // Avoid duplicates
                    if (prev.some((p) => p.id === event.new.id)) return prev;
                    return [...prev, event.new as FeedPost];
                });
            } else if (event.eventType === "UPDATE") {
                setPosts((prev) => {
                    const updated = prev.map((p) =>
                        p.id === event.new.id ? ({ ...p, ...event.new } as FeedPost) : p,
                    );
                    return updated.filter((p) => p.status !== "deleted");
                });
            } else if (event.eventType === "DELETE") {
                setPosts((prev) => prev.filter((p) => p.id !== event.new.id));
            }
        });
        return unsubscribe;
    }, [subscribeToChanges]);

    return (
        <ul>
            {posts.map((p) => (
                <li key={p.id} data-testid={`post-${p.id}`}>
                    {p.first_name} — ${p.cost ?? 0}
                </li>
            ))}
        </ul>
    );
}

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1",
        author_id: "author-1",
        author_type: "player",
        post_type: "sub_need",
        status: "active",
        format: "point_play",
        total_players: 4,
        game_date: "2026-05-10",
        game_time: "09:00",
        skill_level: "4.0",
        location: "Longshore Club",
        court_id: "court-1",
        custom_court: null,
        pro_name: null,
        cost: 40,
        original_cost: null,
        spots_total: 1,
        spots_available: 1,
        view_count: 0,
        notes: null,
        series_id: null,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Bob",
        last_name: "Jones",
        photo_url: null,
        is_friend: false,
        ...overrides,
    };
}

describe("real-time feed updates", () => {
    it("new post appears in feed on INSERT event", async () => {
        let listener: ((event: RealTimeEvent) => void) | null = null;
        const unsubscribe = vi.fn();

        const subscribe = vi.fn((cb: (event: RealTimeEvent) => void) => {
            listener = cb;
            return unsubscribe;
        });

        render(<MiniRealTimeFeed initialPosts={[makePost()]} subscribeToChanges={subscribe} />);

        expect(screen.getByTestId("post-post-1")).toBeInTheDocument();

        act(() => {
            listener?.({
                eventType: "INSERT",
                new: makePost({ id: "post-2", first_name: "Carol", cost: 30 }),
            });
        });

        await waitFor(() => {
            expect(screen.getByTestId("post-post-2")).toBeInTheDocument();
        });
    });

    it("updated post reflects changes on UPDATE event", async () => {
        let listener: ((event: RealTimeEvent) => void) | null = null;
        const unsubscribe = vi.fn();

        render(
            <MiniRealTimeFeed
                initialPosts={[makePost({ cost: 40 })]}
                subscribeToChanges={(cb) => {
                    listener = cb;
                    return unsubscribe;
                }}
            />,
        );

        expect(screen.getByText(/Bob — \$40/)).toBeInTheDocument();

        act(() => {
            listener?.({ eventType: "UPDATE", new: { id: "post-1", cost: 20 } });
        });

        await waitFor(() => {
            expect(screen.getByText(/Bob — \$20/)).toBeInTheDocument();
        });
    });

    it("deleted post is removed from feed on UPDATE event with status deleted", async () => {
        let listener: ((event: RealTimeEvent) => void) | null = null;
        const unsubscribe = vi.fn();

        render(
            <MiniRealTimeFeed
                initialPosts={[makePost()]}
                subscribeToChanges={(cb) => {
                    listener = cb;
                    return unsubscribe;
                }}
            />,
        );

        expect(screen.getByTestId("post-post-1")).toBeInTheDocument();

        act(() => {
            listener?.({ eventType: "UPDATE", new: { id: "post-1", status: "deleted" } });
        });

        await waitFor(() => {
            expect(screen.queryByTestId("post-post-1")).not.toBeInTheDocument();
        });
    });

    it("real-time subscription is cleaned up on unmount", () => {
        const unsubscribe = vi.fn();
        const subscribe = vi.fn((_cb: (event: RealTimeEvent) => void) => unsubscribe);

        const { unmount } = render(
            <MiniRealTimeFeed initialPosts={[makePost()]} subscribeToChanges={subscribe} />,
        );

        unmount();
        expect(unsubscribe).toHaveBeenCalledOnce();
    });
});
