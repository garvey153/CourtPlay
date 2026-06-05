import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePosts } from "./use-posts";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "test-user-id", email: "test@example.com" }, loading: false }),
}));

// vi.mock is hoisted — use vi.hoisted so mockFrom is available inside the factory
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
    supabase: { from: mockFrom },
}));

// ── Chain builder ──────────────────────────────────────────────────────────

/**
 * Builds a chainable mock that every Supabase query builder method returns.
 * Awaiting the chain (via .then) resolves to { data, error }.
 * .single() / .maybeSingle() also resolve to { data, error }.
 */
function buildChain(data: unknown, error: unknown = null) {
    const resolved = { data, error };

    const chain: Record<string, unknown> = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
        eq: vi.fn(),
        neq: vi.fn(),
        in: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        single: vi.fn().mockResolvedValue(resolved),
        maybeSingle: vi.fn().mockResolvedValue(resolved),
        // Thenable — so `await chain` works without .single()
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(resolved).then(resolve, reject),
        catch: (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject),
    };

    // Every chainable method returns the same chain object
    for (const key of ["select", "insert", "update", "upsert", "delete", "eq", "neq", "in", "order", "limit"]) {
        (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    }

    return chain;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getHook() {
    return renderHook(() => usePosts()).result.current;
}

const BASE_SUB_NEED = {
    format: "point_play",
    total_players: 4,
    game_date: "2026-04-15",
    game_time: "09:00",
    skill_level: "4.0",
    court_id: "court-1",
    cost: 25,
} as const;

const BASE_REGULAR_GAME = {
    skill_level: "4.0",
    preferred_days: ["Mon", "Wed"] as string[],
    preferred_times: ["Morning"] as string[],
};

// ── Sub need creation ──────────────────────────────────────────────────────

describe("sub need creation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates a sub_need post with all required fields and returns it with an id", async () => {
        const mockPost = { id: "post-uuid-1", post_type: "sub_need", author_id: "test-user-id", status: "active" };
        mockFrom
            .mockReturnValueOnce(buildChain([])) // getUserActivePostCount
            .mockReturnValueOnce(buildChain(mockPost)); // insert

        const hooks = getHook();
        const result = await hooks.createSubNeedPost(BASE_SUB_NEED);

        expect(result).toEqual(mockPost);
        expect(result.id).toBeDefined();
    });

    it("sets author_id to the current authenticated user", async () => {
        const mockPost = { id: "post-uuid-2", author_id: "test-user-id" };
        const countChain = buildChain([]);
        const insertChain = buildChain(mockPost);
        mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain);

        const hooks = getHook();
        await hooks.createSubNeedPost(BASE_SUB_NEED);

        const insertArgs = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
        expect(insertArgs.author_id).toBe("test-user-id");
    });

    it("sets status to 'active' by default", async () => {
        const insertChain = buildChain({ id: "p3", status: "active" });
        mockFrom.mockReturnValueOnce(buildChain([])).mockReturnValueOnce(insertChain);

        const hooks = getHook();
        await hooks.createSubNeedPost(BASE_SUB_NEED);

        const insertArgs = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
        expect(insertArgs.status).toBe("active");
    });

    it("sets spots_total to 1 when not specified", async () => {
        const insertChain = buildChain({ id: "p4", spots_total: 1 });
        mockFrom.mockReturnValueOnce(buildChain([])).mockReturnValueOnce(insertChain);

        const hooks = getHook();
        // Deliberately omit spots_total
        await hooks.createSubNeedPost({ ...BASE_SUB_NEED });

        const insertArgs = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
        expect(insertArgs.spots_total).toBe(1);
    });
});

// ── Regular game creation ──────────────────────────────────────────────────

describe("regular game creation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates a regular_game post with required fields", async () => {
        const mockPost = { id: "rg-1", post_type: "regular_game", skill_level: "4.0" };
        mockFrom.mockReturnValueOnce(buildChain(mockPost));

        const hooks = getHook();
        const result = await hooks.createRegularGamePost(BASE_REGULAR_GAME);

        expect(result).toEqual(mockPost);
    });

    it("sets expires_at to 30 days from now automatically", async () => {
        const insertChain = buildChain({ id: "rg-2" });
        mockFrom.mockReturnValueOnce(insertChain);

        const before = Date.now();
        const hooks = getHook();
        await hooks.createRegularGamePost(BASE_REGULAR_GAME);
        const after = Date.now();

        const insertArgs = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
        const expiresAt = new Date(insertArgs.expires_at as string).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        expect(expiresAt).toBeGreaterThanOrEqual(before + thirtyDays - 1000);
        expect(expiresAt).toBeLessThanOrEqual(after + thirtyDays + 1000);
    });

    it("stores preferred_days and preferred_times as arrays", async () => {
        const insertChain = buildChain({ id: "rg-3" });
        mockFrom.mockReturnValueOnce(insertChain);

        const hooks = getHook();
        await hooks.createRegularGamePost({
            skill_level: "3.5",
            preferred_days: ["Mon", "Wed"],
            preferred_times: ["Morning", "Afternoon"],
        });

        const insertArgs = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
        expect(Array.isArray(insertArgs.preferred_days)).toBe(true);
        expect(Array.isArray(insertArgs.preferred_times)).toBe(true);
        expect(insertArgs.preferred_days).toEqual(["Mon", "Wed"]);
        expect(insertArgs.preferred_times).toEqual(["Morning", "Afternoon"]);
    });
});

// ── Series creation ────────────────────────────────────────────────────────

describe("series creation", () => {
    beforeEach(() => vi.clearAllMocks());

    const DATES = ["2026-04-15", "2026-04-22", "2026-04-29"];
    const SERIES_BASE = {
        format: "point_play" as const,
        total_players: 4,
        game_time: "09:00",
        skill_level: "4.0",
        court_id: "court-1",
        cost: 25,
    };

    it("given 3 dates, creates 3 separate post rows", async () => {
        const posts = DATES.map((d, i) => ({
            id: `series-post-${i}`,
            game_date: d,
            series_id: "fixed-series-uuid",
        }));
        const insertChain = buildChain(posts);
        mockFrom.mockReturnValueOnce(insertChain);

        const hooks = getHook();
        const result = await hooks.createSeriesPosts(SERIES_BASE, DATES);

        expect(result).toHaveLength(3);
    });

    it("all 3 posts share the same series_id (a valid UUID)", async () => {
        const insertChain = buildChain([]);
        mockFrom.mockReturnValueOnce(insertChain);

        const hooks = getHook();
        await hooks.createSeriesPosts(SERIES_BASE, DATES);

        const rows = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
            series_id: string;
        }>;
        const seriesIds = rows.map((r) => r.series_id);

        // All series_ids are identical
        expect(new Set(seriesIds).size).toBe(1);
        // It is a valid UUID
        expect(seriesIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("each post has its own unique id (as returned by the db)", async () => {
        const posts = DATES.map((d, i) => ({
            id: `unique-id-${i}`,
            game_date: d,
            series_id: "uuid",
        }));
        mockFrom.mockReturnValueOnce(buildChain(posts));

        const hooks = getHook();
        const result = await hooks.createSeriesPosts(SERIES_BASE, DATES);

        const ids = result.map((p) => p.id);
        expect(new Set(ids).size).toBe(3);
    });

    it("each post has the correct individual game_date", async () => {
        const insertChain = buildChain([]);
        mockFrom.mockReturnValueOnce(insertChain);

        const hooks = getHook();
        await hooks.createSeriesPosts(SERIES_BASE, DATES);

        const rows = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
            game_date: string;
        }>;
        expect(rows.map((r) => r.game_date)).toEqual(DATES);
    });
});

// ── Rate limiting ──────────────────────────────────────────────────────────

describe("rate limiting", () => {
    beforeEach(() => vi.clearAllMocks());

    it("getUserActivePostCount returns the correct count", async () => {
        const fivePosts = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }];
        mockFrom.mockReturnValueOnce(buildChain(fivePosts));

        const hooks = getHook();
        const count = await hooks.getUserActivePostCount("test-user-id");

        expect(count).toBe(5);
    });

    it("createSubNeedPost rejects when the user already has 5 active posts", async () => {
        const fivePosts = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }];
        mockFrom.mockReturnValueOnce(buildChain(fivePosts)); // count returns 5

        const hooks = getHook();
        await expect(hooks.createSubNeedPost(BASE_SUB_NEED)).rejects.toThrow(/rate limit/i);
    });
});

// ── getUserPosts ──────────────────────────────────────────────────────────

describe("getUserPosts", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns posts ordered newest-first for the given user", async () => {
        const posts = [
            { id: "p1", author_id: "test-user-id", created_at: "2026-04-10T10:00:00Z" },
            { id: "p2", author_id: "test-user-id", created_at: "2026-04-01T10:00:00Z" },
        ];
        mockFrom.mockReturnValueOnce(buildChain(posts));

        const hooks = getHook();
        const result = await hooks.getUserPosts("test-user-id");

        expect(result).toEqual(posts);
    });

    it("returns an empty array when the user has no posts", async () => {
        mockFrom.mockReturnValueOnce(buildChain([]));

        const hooks = getHook();
        const result = await hooks.getUserPosts("test-user-id");

        expect(result).toEqual([]);
    });

    it("throws when Supabase returns an error", async () => {
        mockFrom.mockReturnValueOnce(buildChain(null, { message: "DB error" }));

        const hooks = getHook();
        await expect(hooks.getUserPosts("test-user-id")).rejects.toMatchObject({ message: "DB error" });
    });
});

// ── updatePost ────────────────────────────────────────────────────────────

describe("updatePost", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls posts.update with the provided fields and returns the updated post", async () => {
        const updatedPost = { id: "post-1", cost: 30, notes: "Updated note" };
        const chain = buildChain(updatedPost);
        mockFrom.mockReturnValueOnce(chain);

        const hooks = getHook();
        const result = await hooks.updatePost("post-1", { cost: 30, notes: "Updated note" });

        expect(result).toEqual(updatedPost);
        expect(chain.update).toHaveBeenCalledWith({ cost: 30, notes: "Updated note" });
    });

    it("throws when Supabase returns an error during update", async () => {
        mockFrom.mockReturnValueOnce(buildChain(null, { message: "Update failed" }));

        const hooks = getHook();
        await expect(hooks.updatePost("post-1", { cost: 99 })).rejects.toMatchObject({
            message: "Update failed",
        });
    });
});
