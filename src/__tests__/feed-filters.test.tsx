import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FeedFilters } from "@/components/app/feed-filters";
import type { FilterState, FeedPost } from "@/types/feed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultFilters: FilterState = {
    skillLevels: [],
    formats: [],
    dateFrom: null,
    dateTo: null,
    courtId: null,
};

const mockCourts = [
    { id: "court-1", name: "Longshore Club" },
    { id: "court-2", name: "Staples High School" },
];

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: crypto.randomUUID(),
        author_id: "user-1",
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
        spots_total: 1,
        spots_available: 1,
        view_count: 0,
        notes: null,
        series_id: null,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Test",
        last_name: "User",
        photo_url: null,
        is_friend: false,
        ...overrides,
    };
}

/** Client-side filter function mirroring feed.tsx applyFilters */
function applyFilters(posts: FeedPost[], f: FilterState): FeedPost[] {
    return posts.filter((p) => {
        if (f.skillLevels.length > 0 && !f.skillLevels.includes(p.skill_level ?? "")) return false;
        if (f.formats.length > 0 && !f.formats.includes(p.play_type ?? p.format ?? "")) return false;
        if (f.dateFrom && p.game_date && p.game_date < f.dateFrom) return false;
        if (f.dateTo && p.game_date && p.game_date > f.dateTo) return false;
        if (f.courtId && p.court_id !== f.courtId) return false;
        return true;
    });
}

// ---------------------------------------------------------------------------
// Controlled FeedFilters wrapper for interaction tests
// ---------------------------------------------------------------------------

function FiltersWrapper({
    initial = defaultFilters,
    onChange,
}: {
    initial?: FilterState;
    onChange?: (f: FilterState) => void;
}) {
    const [filters, setFilters] = useState<FilterState>(initial);
    const [isOpen, setIsOpen] = useState(false);

    const handleChange = (f: FilterState) => {
        setFilters(f);
        onChange?.(f);
    };

    return (
        <>
            {/* The real trigger lives in the header (TopNav); simulate it here. */}
            <button onClick={() => setIsOpen((v) => !v)}>Filters</button>
            <FeedFilters
                filters={filters}
                onChange={handleChange}
                courts={mockCourts}
                isOpen={isOpen}
                onToggle={() => setIsOpen((v) => !v)}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// Pure filter logic tests (no DOM)
// ---------------------------------------------------------------------------

describe("applyFilters — skill level", () => {
    const posts = [
        makePost({ id: "p1", skill_level: "3.0" }),
        makePost({ id: "p2", skill_level: "3.5" }),
        makePost({ id: "p3", skill_level: "4.0" }),
    ];

    it("skill level filter reduces visible posts", () => {
        const result = applyFilters(posts, { ...defaultFilters, skillLevels: ["3.5"] });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("p2");
    });

    it("multiple skill level filters combine with OR logic", () => {
        const result = applyFilters(posts, { ...defaultFilters, skillLevels: ["3.0", "4.0"] });
        expect(result).toHaveLength(2);
        const ids = result.map((p) => p.id);
        expect(ids).toContain("p1");
        expect(ids).toContain("p3");
        expect(ids).not.toContain("p2");
    });
});

describe("applyFilters — format / play type", () => {
    it("format filter works correctly for regular_game posts", () => {
        const posts = [
            makePost({ id: "pp", format: "point_play", play_type: null }),
            makePost({ id: "cl", format: "clinic", play_type: null }),
        ];
        const result = applyFilters(posts, { ...defaultFilters, formats: ["point_play"] });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("pp");
    });

    it("play_type filter works for sub_need posts (format is null)", () => {
        const posts = [
            makePost({ id: "d", format: null, play_type: "doubles" }),
            makePost({ id: "c", format: null, play_type: "clinic" }),
        ];
        const result = applyFilters(posts, { ...defaultFilters, formats: ["doubles"] });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("d");
    });
});

describe("applyFilters — location", () => {
    it("location filter works correctly", () => {
        const posts = [
            makePost({ id: "c1", court_id: "court-1" }),
            makePost({ id: "c2", court_id: "court-2" }),
        ];
        const result = applyFilters(posts, { ...defaultFilters, courtId: "court-1" });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("c1");
    });
});

describe("applyFilters — empty state", () => {
    it("returns empty array when filters match zero posts", () => {
        const posts = [makePost({ skill_level: "4.0" })];
        const result = applyFilters(posts, { ...defaultFilters, skillLevels: ["2.5"] });
        expect(result).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// UI interaction tests
// ---------------------------------------------------------------------------

describe("FeedFilters UI", () => {
    it("Clear all resets every selection", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<FiltersWrapper onChange={onChange} />);

        // Open the sheet (the trigger lives in the header)
        await user.click(screen.getByRole("button", { name: /^Filters$/i }));

        // Expand the skill-level category, then select a chip
        await user.click(screen.getByRole("button", { name: /All skill levels/i }));
        await user.click(screen.getByRole("button", { name: "3.5" }));

        // Clear all resets the filters
        await user.click(screen.getByRole("button", { name: /Clear all/i }));

        const lastCall = onChange.mock.calls.at(-1)?.[0] as FilterState;
        expect(lastCall.skillLevels).toHaveLength(0);
        expect(lastCall.formats).toHaveLength(0);
        expect(lastCall.courtId).toBeNull();
    });

    it("skill level chip toggles on and off", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<FiltersWrapper onChange={onChange} />);

        await user.click(screen.getByRole("button", { name: /^Filters$/i }));
        await user.click(screen.getByRole("button", { name: /All skill levels/i }));

        // Select 4.0 (only the chip matches before selection)
        await user.click(screen.getByRole("button", { name: "4.0" }));
        expect((onChange.mock.calls.at(-1)?.[0] as FilterState).skillLevels).toContain("4.0");

        // After selecting, the row summary also reads "4.0"; the chip is the last match
        const matches = screen.getAllByRole("button", { name: "4.0" });
        await user.click(matches[matches.length - 1]);
        expect((onChange.mock.calls.at(-1)?.[0] as FilterState).skillLevels).not.toContain("4.0");
    });

    it("play type chip selects on the formats field", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<FiltersWrapper onChange={onChange} />);

        await user.click(screen.getByRole("button", { name: /^Filters$/i }));
        await user.click(screen.getByRole("button", { name: /All play types/i }));
        await user.click(screen.getByRole("button", { name: "Doubles" }));

        expect((onChange.mock.calls.at(-1)?.[0] as FilterState).formats).toContain("doubles");
    });
});
