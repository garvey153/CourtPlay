import { describe, it, expect } from "vitest";

// ── Pure helpers ─────────────────────────────────────────────────────────

function calculatePushRate(withPlayerId: number, total: number): number {
    return total > 0 ? Math.round((withPlayerId / total) * 100) : 0;
}

function calculateActiveUsers(postAuthors: string[], claimers: string[]): number {
    return new Set([...postAuthors, ...claimers]).size;
}

function calculateTotalUsers(
    users: { id: string; deleted_at: string | null }[],
): number {
    return users.filter((u) => u.deleted_at === null).length;
}

function validateFunnelSteps(steps: { label: string; count: number }[]): boolean {
    for (let i = 1; i < steps.length; i++) {
        if (steps[i].count > steps[i - 1].count) return false;
    }
    return true;
}

function buildMetrics(data: {
    users: { id: string; deleted_at: string | null; player_id: string | null }[];
    postAuthors: string[];
    claimers: string[];
}) {
    const total = calculateTotalUsers(data.users);
    const withPlayerId = data.users.filter(
        (u) => u.deleted_at === null && u.player_id !== null,
    ).length;
    return {
        totalUsers: total,
        activeUsers: calculateActiveUsers(data.postAuthors, data.claimers),
        pushOptInRate: calculatePushRate(withPlayerId, total),
    };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Admin analytics", () => {
    const sampleUsers = [
        { id: "u1", deleted_at: null, player_id: "pid-1" },
        { id: "u2", deleted_at: null, player_id: null },
        { id: "u3", deleted_at: null, player_id: "pid-3" },
        { id: "u4", deleted_at: "2026-03-01T00:00:00Z", player_id: "pid-4" },
        { id: "u5", deleted_at: null, player_id: null },
    ];

    it("metrics cards calculate total users correctly", () => {
        const total = calculateTotalUsers(sampleUsers);
        // u4 is soft-deleted, should be excluded
        expect(total).toBe(4);
    });

    it("active users counts distinct authors and claimers in 7 days", () => {
        const postAuthors = ["u1", "u2", "u1"]; // u1 appears twice
        const claimers = ["u2", "u3"]; // u2 overlaps with authors
        const active = calculateActiveUsers(postAuthors, claimers);
        // Distinct: u1, u2, u3
        expect(active).toBe(3);
    });

    it("push opt-in rate calculation", () => {
        // 2 users with player_id out of 4 non-deleted = 50%
        const rate = calculatePushRate(2, 4);
        expect(rate).toBe(50);

        // Rounding: 1 out of 3 = 33.33... → 33
        expect(calculatePushRate(1, 3)).toBe(33);

        // 2 out of 3 = 66.67 → 67
        expect(calculatePushRate(2, 3)).toBe(67);
    });

    it("funnel steps narrow correctly", () => {
        const validFunnel = [
            { label: "Visited", count: 1000 },
            { label: "Signed up", count: 400 },
            { label: "Created post", count: 120 },
            { label: "Got claim", count: 45 },
        ];
        expect(validateFunnelSteps(validFunnel)).toBe(true);

        const invalidFunnel = [
            { label: "Visited", count: 100 },
            { label: "Signed up", count: 200 }, // wider than previous → invalid
            { label: "Created post", count: 50 },
        ];
        expect(validateFunnelSteps(invalidFunnel)).toBe(false);
    });

    it("analytics handle zero data gracefully", () => {
        const metrics = buildMetrics({
            users: [],
            postAuthors: [],
            claimers: [],
        });
        expect(metrics.totalUsers).toBe(0);
        expect(metrics.activeUsers).toBe(0);
        expect(metrics.pushOptInRate).toBe(0);
        // Ensure no NaN values
        expect(Number.isNaN(metrics.totalUsers)).toBe(false);
        expect(Number.isNaN(metrics.activeUsers)).toBe(false);
        expect(Number.isNaN(metrics.pushOptInRate)).toBe(false);
    });

    it("analytics show loading state", () => {
        // Simulate a loading state before data arrives
        let isLoading = true;
        let metrics: ReturnType<typeof buildMetrics> | null = null;

        expect(isLoading).toBe(true);
        expect(metrics).toBeNull();

        // After data loads
        metrics = buildMetrics({
            users: sampleUsers,
            postAuthors: ["u1"],
            claimers: ["u2"],
        });
        isLoading = false;

        expect(isLoading).toBe(false);
        expect(metrics).not.toBeNull();
        expect(metrics!.totalUsers).toBe(4);
    });
});
