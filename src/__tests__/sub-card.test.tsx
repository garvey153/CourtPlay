import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SubCard, gameEndMs, formatWhen, KIND_CONFIG } from "@/components/app/sub-card";
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

// A date ~30 days out so the default fixture reads as an upcoming (not expired)
// game regardless of when the suite runs.
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1",
        author_id: "author-1",
        author_type: "player",
        post_type: "sub_need",
        status: "active",
        format: "point_play",
        play_type: "doubles",
        duration: 2,
        total_players: 4,
        game_date: FUTURE_DATE,
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

describe("gameEndMs", () => {
    it("returns null for undated posts", () => {
        expect(gameEndMs({ game_date: null, game_time: null })).toBeNull();
    });

    it("parses a Postgres 'HH:MM:SS' time into a valid timestamp (not NaN)", () => {
        const ms = gameEndMs({ game_date: "2026-07-08", game_time: "09:00:00" });
        expect(ms).not.toBeNull();
        expect(Number.isNaN(ms)).toBe(false);
        expect(ms).toBe(new Date("2026-07-08T09:00").getTime());
    });

    it("defaults a null time to end-of-day", () => {
        const ms = gameEndMs({ game_date: "2026-07-08", game_time: null });
        expect(ms).toBe(new Date("2026-07-08T23:59").getTime());
    });
});

describe("SubCard", () => {
    it("renders title from play type, sport, and start time", () => {
        render(<SubCard post={makePost()} />);
        // "Doubles Tennis · {weekday} 9:00am"
        expect(screen.getByText(/Doubles Tennis · .* 9:00am/i)).toBeInTheDocument();
    });

    it("renders subtitle from court, skill, and duration", () => {
        render(<SubCard post={makePost()} />);
        expect(screen.getByText("Longshore Club · NTRP 4.0 · 2 hrs")).toBeInTheDocument();
    });

    it("omits duration from subtitle when not set", () => {
        render(<SubCard post={makePost({ duration: null })} />);
        expect(screen.getByText("Longshore Club · NTRP 4.0")).toBeInTheDocument();
    });

    it("renders poster name and price", () => {
        render(<SubCard post={makePost()} />);
        expect(screen.getByText(/Jane ·/)).toBeInTheDocument();
        expect(screen.getByText("$25")).toBeInTheDocument();
    });

    it("shows Free when cost is null", () => {
        render(<SubCard post={makePost({ cost: null })} />);
        expect(screen.getByText("Free")).toBeInTheDocument();
    });

    it("shows Open badge for an active post with spots available", () => {
        render(<SubCard post={makePost()} />);
        expect(screen.getByText("Open")).toBeInTheDocument();
    });

    it("shows Claimed badge when all spots are filled", () => {
        render(<SubCard post={makePost({ spots_available: 0 })} />);
        expect(screen.getByText("Claimed")).toBeInTheDocument();
    });

    it("shows Expired badge for an expired post", () => {
        render(<SubCard post={makePost({ status: "expired" })} />);
        expect(screen.getByText("Expired")).toBeInTheDocument();
    });

    // 2 days ago at noon — unambiguously in the past regardless of timezone.
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    it("shows Expired badge once the game date/time has passed", () => {
        // game_time comes from Postgres with seconds ("HH:MM:SS") — must still parse.
        render(<SubCard post={makePost({ game_date: pastDate, game_time: "12:00:00" })} />);
        expect(screen.getByText("Expired")).toBeInTheDocument();
    });

    it("keeps a filled spot as Claimed even after the game date/time has passed", () => {
        render(<SubCard post={makePost({ game_date: pastDate, game_time: "12:00:00", spots_available: 0 })} />);
        expect(screen.getByText("Claimed")).toBeInTheDocument();
    });

    it("shows Pending badge when the viewer's claim is pending", () => {
        render(<SubCard post={makePost({ user_claim_status: "pending" })} />);
        expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("shows Approved badge when the viewer's claim is approved", () => {
        render(<SubCard post={makePost({ user_claim_status: "approved" })} />);
        expect(screen.getByText("Approved")).toBeInTheDocument();
    });

    it("shows Friend badge when is_friend is true", () => {
        render(<SubCard post={makePost({ is_friend: true })} />);
        expect(screen.getByText("Friend")).toBeInTheDocument();
    });

    it("does not show Friend badge when is_friend is false", () => {
        render(<SubCard post={makePost({ is_friend: false })} />);
        expect(screen.queryByText("Friend")).not.toBeInTheDocument();
    });

    it("renders the notes bubble only when notes are present", () => {
        const { rerender } = render(<SubCard post={makePost({ notes: null })} />);
        expect(screen.queryByText(/“.*”/)).not.toBeInTheDocument();

        rerender(
            <MemoryRouter>
                <SubCard post={makePost({ notes: "Bring your own balls" })} />
            </MemoryRouter>,
        );
        expect(screen.getByText("“Bring your own balls”")).toBeInTheDocument();
    });

    it("calls onOpenDetail with the post when tapped", () => {
        const onOpenDetail = vi.fn();
        render(<SubCard post={makePost()} onOpenDetail={onOpenDetail} />);
        fireEvent.click(screen.getByRole("button"));
        expect(onOpenDetail).toHaveBeenCalledTimes(1);
        expect(onOpenDetail).toHaveBeenCalledWith(expect.objectContaining({ id: "post-1" }));
    });

    it("does not open the detail sheet when an expired post is tapped", () => {
        const onOpenDetail = vi.fn();
        render(<SubCard post={makePost({ status: "expired" })} onOpenDetail={onOpenDetail} />);
        fireEvent.click(screen.getByRole("button"));
        expect(onOpenDetail).not.toHaveBeenCalled();
    });
});

/**
 * Status badges are label-only. They used to carry a coloured dot; the badge's
 * own background and text already encode the state, so the dot was a second
 * copy of the same signal.
 *
 * Pinned in two ways because the render sites and the config drifted apart
 * before: no dot element in the markup, and no `dot` key left to re-wire one to.
 */
describe("status badges carry no dot", () => {
    it("renders the label without a dot element", () => {
        const { container } = render(<SubCard post={makePost()} />);
        const badge = screen.getByText("Open");
        expect(badge.querySelector("span")).toBeNull();
        // The dot was the only 1.5-unit circle on the card.
        expect(container.querySelector(".size-1\\.5")).toBeNull();
    });

    it("keeps no dot in the shared config", () => {
        for (const config of Object.values(KIND_CONFIG)) {
            expect(config).not.toHaveProperty("dot");
        }
    });
});

/**
 * A weekday only identifies a day while there is one of them coming. Past six
 * days out, "Sat" could be any of several Saturdays, so the date takes over.
 */
describe("formatWhen", () => {
    const iso = (daysFromToday: number) => {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + daysFromToday);
        return d.toISOString().slice(0, 10);
    };

    it("uses the weekday inside the next six days", () => {
        for (const days of [0, 1, 3, 6]) {
            const out = formatWhen(iso(days), "09:00");
            expect(out).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) 9:00am$/);
            expect(out).not.toContain(",");
        }
    });

    it("uses a numeric month and day beyond that, with a comma before the time", () => {
        const out = formatWhen(iso(7), "09:00");
        expect(out).toMatch(/^\d{1,2}\/\d{1,2}, 9:00am$/);
    });

    /**
     * Pinned to an exact string, on a frozen clock. The regex above is happy
     * with any two numbers, so it cannot see the off-by-one that getMonth()
     * invites — 0 for January.
     */
    it("numbers the month from one, not zero", () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date("2026-05-14T12:00:00"));
            expect(formatWhen("2026-05-23", "09:00")).toBe("5/23, 9:00am");
            expect(formatWhen("2027-01-03", "18:30")).toBe("1/3, 6:30pm");
            expect(formatWhen("2026-12-25", null)).toBe("12/25,");
        } finally {
            vi.useRealTimers();
        }
    });

    /** "Tue" on an expired post reads as the Tuesday coming, not the one gone. */
    it("uses month and day for a date already past", () => {
        expect(formatWhen(iso(-2), "18:00")).toMatch(/^\d{1,2}\/\d{1,2}, 6:00pm$/);
    });

    it("still handles a missing date or time", () => {
        expect(formatWhen(null, "09:00")).toBe("9:00am");
        expect(formatWhen(iso(30), null)).toMatch(/^\d{1,2}\/\d{1,2},$/);
    });
});
