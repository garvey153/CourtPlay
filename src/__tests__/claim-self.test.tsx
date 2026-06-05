import { describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SubCard } from "@/components/app/sub-card";
import type { FeedPost } from "@/types/feed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (ui: any) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn() },
}));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1", author_id: "user-1", author_type: "player",
        post_type: "sub_need", format: "point_play", total_players: 4,
        game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5",
        location: "Longshore Club", court_id: null, custom_court: null,
        pro_name: null, cost: 25, original_cost: null, spots_total: 4,
        series_id: null, notes: null, status: "active", view_count: 5,
        expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(), first_name: "Mike", last_name: "Chen",
        photo_url: null, is_friend: false, spots_available: 3,
        user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...overrides,
    };
}

describe("claim self prevention", () => {
    it("poster cannot claim their own post", () => {
        render(<SubCard post={makePost()} currentUserId="user-1" />);
        expect(screen.queryByText("Claim spot")).not.toBeInTheDocument();
        expect(screen.getByText("Your post")).toBeInTheDocument();
    });
});
