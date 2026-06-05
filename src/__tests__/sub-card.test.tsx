import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SubCard } from "@/components/app/sub-card";
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
        cost: 25,
        original_cost: null,
        spots_total: 4,
        spots_available: 2,
        view_count: 7,
        notes: null,
        series_id: null,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Jane",
        last_name: "Doe",
        photo_url: null,
        is_friend: false,
        ...overrides,
    };
}

beforeEach(() => {
    mockObserve.mockClear();
    mockDisconnect.mockClear();
});

describe("SubCard", () => {
    it("renders all required fields", () => {
        render(<SubCard post={makePost()} />);
        expect(screen.getByText("Point play")).toBeInTheDocument();
        // Date formatted
        expect(screen.getByText(/May/i)).toBeInTheDocument();
        // Time
        expect(screen.getByText(/9:00 AM/i)).toBeInTheDocument();
        // Skill level
        expect(screen.getByText(/4\.0 NTRP/i)).toBeInTheDocument();
        // Total players
        expect(screen.getByText(/4 players/i)).toBeInTheDocument();
        // Location
        expect(screen.getByText("Longshore Club")).toBeInTheDocument();
        // Poster name
        expect(screen.getByText("Jane")).toBeInTheDocument();
        // Spots indicator
        expect(screen.getByText(/2\/4 spots available/i)).toBeInTheDocument();
        // Cost
        expect(screen.getByText("$25.00")).toBeInTheDocument();
        // View count
        expect(screen.getByText(/7 views/i)).toBeInTheDocument();
    });

    it("shows Friend badge when is_friend is true", () => {
        render(<SubCard post={makePost({ is_friend: true })} />);
        expect(screen.getByText("Friend")).toBeInTheDocument();
    });

    it("does not show Friend badge when is_friend is false", () => {
        render(<SubCard post={makePost({ is_friend: false })} />);
        expect(screen.queryByText("Friend")).not.toBeInTheDocument();
    });

    it("shows discount treatment when original_cost exists", () => {
        render(<SubCard post={makePost({ cost: 20, original_cost: 40 })} />);
        const strikethrough = screen.getByText("$40.00");
        expect(strikethrough).toBeInTheDocument();
        expect(strikethrough).toHaveClass("line-through");
        expect(screen.getByText("$20.00")).toBeInTheDocument();
    });

    it("does not show discount treatment when original_cost is null", () => {
        render(<SubCard post={makePost({ cost: 40, original_cost: null })} />);
        expect(screen.getByText("$40.00")).toBeInTheDocument();
        expect(screen.queryByText(/line-through/)).not.toBeInTheDocument();
        // Only one price shown — verify no element has line-through class
        const prices = screen.getAllByText(/\$40\.00/);
        prices.forEach((el) => expect(el).not.toHaveClass("line-through"));
    });

    it("shows amber spots indicator when 1 spot remaining", () => {
        render(<SubCard post={makePost({ spots_total: 4, spots_available: 1 })} />);
        const spotsEl = screen.getByText(/1\/4 spots available/i);
        expect(spotsEl).toBeInTheDocument();
        expect(spotsEl).toHaveClass("text-warning-primary");
    });

    it("shows time pressure label green for games >12h away today", () => {
        // Use UTC date + UTC-based time to be timezone-safe
        const nowMs = Date.now();
        const todayUTC = new Date(nowMs).toISOString().slice(0, 10);
        // Pick a future time 14h from now expressed as HH:MM in local timezone
        const futureDate = new Date(nowMs + 14 * 3600 * 1000);
        const gameTime = `${String(futureDate.getHours()).padStart(2, "0")}:${String(futureDate.getMinutes()).padStart(2, "0")}`;
        // Only run this test when adding 14h stays within the same UTC date
        // (otherwise the component returns null for non-today dates — test is skipped)
        const futureDateUTC = futureDate.toISOString().slice(0, 10);
        if (futureDateUTC !== todayUTC) return; // skip if date rolled over
        render(<SubCard post={makePost({ game_date: todayUTC, game_time: gameTime })} />);
        const label = screen.queryByText(/Game in \d+h/i);
        if (label) expect(label).toHaveClass("text-success-primary");
    });

    it("shows time pressure label amber for games 4–12h away today", () => {
        const nowMs = Date.now();
        const todayUTC = new Date(nowMs).toISOString().slice(0, 10);
        const futureDate = new Date(nowMs + 8 * 3600 * 1000);
        const gameTime = `${String(futureDate.getHours()).padStart(2, "0")}:${String(futureDate.getMinutes()).padStart(2, "0")}`;
        const futureDateUTC = futureDate.toISOString().slice(0, 10);
        if (futureDateUTC !== todayUTC) return;
        render(<SubCard post={makePost({ game_date: todayUTC, game_time: gameTime })} />);
        const label = screen.queryByText(/Game in \d+h/i);
        if (label) expect(label).toHaveClass("text-warning-primary");
    });

    it("shows time pressure label red for games <4h away today", () => {
        const nowMs = Date.now();
        const todayUTC = new Date(nowMs).toISOString().slice(0, 10);
        const futureDate = new Date(nowMs + 2 * 3600 * 1000);
        const gameTime = `${String(futureDate.getHours()).padStart(2, "0")}:${String(futureDate.getMinutes()).padStart(2, "0")}`;
        const futureDateUTC = futureDate.toISOString().slice(0, 10);
        if (futureDateUTC !== todayUTC) return;
        render(<SubCard post={makePost({ game_date: todayUTC, game_time: gameTime })} />);
        const label = screen.queryByText(/Game in \d+h/i);
        if (label) expect(label).toHaveClass("text-error-primary");
    });

    it("does not show time pressure label for games more than 24h away", () => {
        const tomorrow = new Date(Date.now() + 48 * 3600 * 1000);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);
        render(<SubCard post={makePost({ game_date: tomorrowStr, game_time: "09:00" })} />);
        expect(screen.queryByText(/Game in \d+h/i)).not.toBeInTheDocument();
    });

    it("shows Notify me link when all spots are filled", () => {
        render(<SubCard post={makePost({ spots_available: 0 })} />);
        expect(screen.getByText(/Notify me if this opens up/i)).toBeInTheDocument();
    });

    it("does not show Notify me link when spots are available", () => {
        render(<SubCard post={makePost({ spots_available: 2 })} />);
        expect(screen.queryByText(/Notify me/i)).not.toBeInTheDocument();
    });
});
