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
        if (f.formats.length > 0 && !f.formats.includes(p.format ?? "")) return false;
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

describe("applyFilters — format", () => {
    it("format filter works correctly", () => {
        const posts = [
            makePost({ id: "pp", format: "point_play" }),
            makePost({ id: "cl", format: "clinic" }),
        ];
        const result = applyFilters(posts, { ...defaultFilters, formats: ["point_play"] });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("pp");
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
    it("Clear filters resets all selections", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<FiltersWrapper onChange={onChange} />);

        // Open filters panel
        const filtersBtn = screen.getByRole("button", { name: /Filters/i });
        await user.click(filtersBtn);

        // Select a skill level chip
        const chip35 = screen.getByRole("button", { name: "3.5" });
        await user.click(chip35);

        // Now a "Clear" button should appear
        const clearBtn = screen.getByRole("button", { name: /Clear/i });
        await user.click(clearBtn);

        // The last onChange call should have empty filters
        const lastCall = onChange.mock.calls.at(-1)?.[0] as FilterState;
        expect(lastCall.skillLevels).toHaveLength(0);
        expect(lastCall.formats).toHaveLength(0);
        expect(lastCall.courtId).toBeNull();
    });

    it("skill level chip toggles on and off", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(<FiltersWrapper onChange={onChange} />);

        // Open filters panel
        await user.click(screen.getByRole("button", { name: /Filters/i }));

        // Select 4.0
        await user.click(screen.getByRole("button", { name: "4.0" }));
        const afterSelect = onChange.mock.calls.at(-1)?.[0] as FilterState;
        expect(afterSelect.skillLevels).toContain("4.0");

        // Deselect 4.0
        await user.click(screen.getByRole("button", { name: "4.0" }));
        const afterDeselect = onChange.mock.calls.at(-1)?.[0] as FilterState;
        expect(afterDeselect.skillLevels).not.toContain("4.0");
    });
});
