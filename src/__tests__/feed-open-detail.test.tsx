import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Feed } from "@/pages/feed";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc: vi.fn(),
        // A permissive chainable stub: the feed builds several different query
        // chains and this test cares about none of them.
        from: vi.fn(() => {
            const chain: Record<string, unknown> = {};
            const result = Promise.resolve({ data: [], error: null });
            for (const m of ["select", "eq", "in", "order", "limit", "gte", "lte", "neq", "is", "not"]) {
                chain[m] = () => chain;
            }
            chain.then = result.then.bind(result);
            chain.maybeSingle = () => result;
            chain.single = () => result;
            return chain;
        }),
        channel: vi.fn(() => ({ on: () => ({ subscribe: () => ({}) }) })),
        removeChannel: vi.fn(),
    },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me-1" }, loading: false }) }));
vi.mock("@/hooks/use-profile", () => ({
    useProfile: () => ({
        profile: { id: "me-1", first_name: "Me", last_name: "User", photo_url: null, skill_level: "4.0" },
        loading: false,
    }),
}));
vi.mock("@/hooks/use-realtime-posts", () => ({
    useRealtimePosts: () => {},
    postAffectsViewer: () => false,
    PostChangeRow: {},
}));
vi.mock("@/lib/notifications", () => ({ sendNotification: vi.fn() }));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const rpc = vi.mocked(supabase.rpc);

const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

/** One of the viewer's own sub posts — the path that used to await the network. */
const minePost = {
    id: "p-1", post_type: "sub_need", author_id: "me-1", status: "active",
    format: "Doubles", play_type: "match", duration: 2, skill_level: "4.0",
    notes: null, game_date: future, game_time: "09:00", location: "Longshore Club",
    custom_court: null, cost: 25, original_cost: null, created_at: new Date().toISOString(),
    expires_at: null, first_name: "Me", last_name: "User", photo_url: null,
    is_friend: false, claim_count: 0, view_count: 0, tagged_group_id: null,
};
const mineWithClaims = { ...minePost, claims: [] };

/**
 * Tapping your own post in the feed used to `await get_my_posts_with_claims`
 * BEFORE opening anything — a full network round trip in front of every tap, for
 * data the feed had already loaded. On a phone that reads as the sheet being
 * broken rather than slow.
 *
 * The sheet now opens from what is already in state and refreshes behind itself.
 * These pin that: the first assertion deliberately runs while the refresh is
 * still pending, so a regression to await-then-open fails here.
 */
describe("feed — opening your own post", () => {
    beforeEach(() => rpc.mockReset());

    const setup = (opts: { mineNeverResolves?: boolean } = {}) => {
        rpc.mockImplementation(((fn: string) => {
            if (fn === "get_feed") return Promise.resolve({ data: [minePost], error: null });
            if (fn === "get_my_posts_with_claims") {
                return opts.mineNeverResolves
                    ? new Promise(() => {}) // never settles
                    : Promise.resolve({ data: [mineWithClaims], error: null });
            }
            return Promise.resolve({ data: [], error: null });
        }) as unknown as typeof rpc);
    };

    it("opens the sheet without waiting for the network", async () => {
        setup({ mineNeverResolves: false });
        render(<MemoryRouter><Feed /></MemoryRouter>);

        const card = await screen.findByText(/Longshore Club/);
        // The feed's own load populates myPosts; wait for it before tapping.
        await waitFor(() => expect(rpc).toHaveBeenCalledWith("get_my_posts_with_claims"));
        rpc.mockClear();
        setup({ mineNeverResolves: true }); // any refresh from here on hangs

        await userEvent.click(card);

        // Open despite the refresh never settling — this is the whole point.
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    });

    it("still opens a post that is not one of yours", async () => {
        rpc.mockImplementation(((fn: string) => {
            if (fn === "get_feed")
                return Promise.resolve({ data: [{ ...minePost, author_id: "someone-else" }], error: null });
            return Promise.resolve({ data: [], error: null });
        }) as unknown as typeof rpc);
        render(<MemoryRouter><Feed /></MemoryRouter>);

        await userEvent.click(await screen.findByText(/Longshore Club/));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    });
});
