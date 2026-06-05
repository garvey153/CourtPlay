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
        ...overrides,
    };
}

beforeEach(() => {
    mockObserve.mockClear();
    mockDisconnect.mockClear();
});

describe("GroupCard", () => {
    it("renders all required fields", () => {
        render(<GroupCard post={makePost()} profileComplete={false} />);
        // Format badge
        expect(screen.getByText("Regular game")).toBeInTheDocument();
        // Skill level
        expect(screen.getByText(/3\.5 NTRP/i)).toBeInTheDocument();
        // Preferred days
        expect(screen.getByText(/Monday/i)).toBeInTheDocument();
        // Preferred times
        expect(screen.getByText(/Morning/i)).toBeInTheDocument();
        // Preferred courts / location
        expect(screen.getByText("Longshore Club")).toBeInTheDocument();
        // Poster name
        expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
        // Brief note
        expect(screen.getByText(/Looking for consistent group/i)).toBeInTheDocument();
    });

    it("shows contact info section for users with complete profiles", () => {
        render(<GroupCard post={makePost()} profileComplete={true} />);
        // The card should NOT show the "complete your profile" prompt
        expect(
            screen.queryByText(/Complete your profile to see contact details/i),
        ).not.toBeInTheDocument();
        // Contact details placeholder should be shown
        expect(screen.getByText(/Contact details shared after connecting/i)).toBeInTheDocument();
    });

    it("hides contact info for users without complete profiles", () => {
        render(<GroupCard post={makePost()} profileComplete={false} />);
        expect(
            screen.getByText(/Complete your profile to see contact details/i),
        ).toBeInTheDocument();
    });

    it("shows share and report buttons", () => {
        render(<GroupCard post={makePost()} profileComplete={false} currentUserId="viewer-1" />);
        expect(screen.getByRole("button", { name: /Share/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /More options/i })).toBeInTheDocument();
    });
});
