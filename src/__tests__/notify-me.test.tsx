import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { SubCard } from "@/components/app/sub-card";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (ui: any) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
import type { FeedPost } from "@/types/feed";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
}));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const rpc = vi.mocked(supabase.rpc);

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1", author_id: "author-1", author_type: "player",
        post_type: "sub_need", format: "point_play", total_players: 4,
        game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5",
        location: "Longshore Club", court_id: null, custom_court: null,
        pro_name: null, cost: 25, original_cost: null, spots_total: 2,
        series_id: null, notes: null, status: "active", view_count: 10,
        expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(), first_name: "Mike", last_name: "Chen",
        photo_url: null, is_friend: false, spots_available: 2,
        user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...overrides,
    };
}

beforeEach(() => { rpc.mockClear(); });

describe("notify me", () => {
    it("link shown when spots_available = 0 and no active claim", () => {
        render(<SubCard post={makePost({ spots_available: 0 })} currentUserId="other-user" />);
        expect(screen.getByText("Notify me if this opens up")).toBeInTheDocument();
    });

    it("link not shown when spots are available", () => {
        render(<SubCard post={makePost({ spots_available: 2 })} currentUserId="other-user" />);
        expect(screen.queryByText("Notify me if this opens up")).not.toBeInTheDocument();
    });

    it("calls add_notify_me RPC on click", async () => {
        const user = userEvent.setup();
        render(<SubCard post={makePost({ spots_available: 0 })} currentUserId="other-user" />);
        await user.click(screen.getByText("Notify me if this opens up"));
        expect(rpc).toHaveBeenCalledWith("add_notify_me", { p_post_id: "post-1" });
    });

    it("shows confirmation after click", async () => {
        const user = userEvent.setup();
        render(<SubCard post={makePost({ spots_available: 0 })} currentUserId="other-user" />);
        await user.click(screen.getByText("Notify me if this opens up"));
        expect(await screen.findByText(/We'll notify you/)).toBeInTheDocument();
    });

    it("already done shows confirmation text immediately", () => {
        render(<SubCard post={makePost({ spots_available: 0, user_notify_me: true })} currentUserId="other-user" />);
        expect(screen.getByText(/We'll notify you/)).toBeInTheDocument();
        expect(screen.queryByText("Notify me if this opens up")).not.toBeInTheDocument();
    });

    it("not shown on own posts", () => {
        render(<SubCard post={makePost({ spots_available: 0 })} currentUserId="author-1" />);
        expect(screen.queryByText("Notify me if this opens up")).not.toBeInTheDocument();
    });
});
