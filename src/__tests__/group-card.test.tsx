import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { GroupCard } from "@/components/app/group-card";
import type { FeedPost } from "@/types/feed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (ui: any) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

// Stub IntersectionObserver for JSDOM (must be a proper constructor)
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
    observe = mockObserve;
    disconnect = mockDisconnect;
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-2",
        author_id: "author-2",
        author_type: "player",
        post_type: "regular_game",
        status: "active",
        format: "point_play",
        play_type: null,
        duration: null,
        total_players: null,
        game_date: null,
        game_time: null,
        skill_level: "3.5",
        location: "Longshore Club",
        court_id: "court-1",
        custom_court: null,
        pro_name: null,
        cost: null,
        original_cost: null,
        spots_total: 0,
        spots_available: 0,
        view_count: 3,
        notes: "Looking for consistent group",
        series_id: null,
        expires_at: null,
        preferred_days: ["Monday", "Wednesday"],
        preferred_times: ["Morning"],
        created_at: new Date().toISOString(),
        first_name: "Alice",
        last_name: "Smith",
        photo_url: null,
        is_friend: false,
        user_claim_status: null,
        user_claim_id: null,
        user_notify_me: false,
        ...overrides,
    };
}

beforeEach(() => {
    mockObserve.mockClear();
    mockDisconnect.mockClear();
});

describe("GroupCard", () => {
    it("renders the Regular Play card with all required fields", () => {
        render(<GroupCard post={makePost()} profileComplete={false} />);
        // Title folds the play type + skill level
        expect(screen.getByText(/Tennis, Regular Play · NTRP 3\.5/i)).toBeInTheDocument();
        // Preferred days + times share a line
        expect(screen.getByText(/Monday/i)).toBeInTheDocument();
        expect(screen.getByText(/Morning/i)).toBeInTheDocument();
        // Location
        expect(screen.getByText("Longshore Club")).toBeInTheDocument();
        // Poster name links to the profile (first name + last initial)
        expect(screen.getByRole("link", { name: /Alice S\./i })).toBeInTheDocument();
        // Brief note
        expect(screen.getByText(/Looking for consistent group/i)).toBeInTheDocument();
    });

    it("shows the friend badge for friends' posts", () => {
        render(<GroupCard post={makePost({ is_friend: true })} profileComplete={false} />);
        expect(screen.getByText("Friend")).toBeInTheDocument();
    });

    it("renders no actions menu (clean Regular Play card)", () => {
        render(<GroupCard post={makePost()} profileComplete={false} currentUserId="viewer-1" />);
        expect(screen.queryByRole("button", { name: /More options/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/Report issue/i)).not.toBeInTheDocument();
    });
});
