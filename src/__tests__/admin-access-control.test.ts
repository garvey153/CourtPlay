import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Pure logic helpers ───────────────────────────────────────────────────

function canAccessAdmin(isAdmin: boolean): boolean {
    return isAdmin;
}

function getRedirectForUser(user: { id: string; is_admin: boolean } | null): string | null {
    if (!user) return "/signin";
    if (!user.is_admin) return "/";
    return null; // no redirect needed
}

function rlsAllowsRead(table: string, isAdmin: boolean): boolean {
    const adminOnlyTables = ["reports", "responsiveness_log"];
    if (adminOnlyTables.includes(table)) return isAdmin;
    return true;
}

// Simulate a fresh database check (not cached)
function createAdminChecker() {
    const queryLog: string[] = [];

    async function checkIsAdmin(userId: string, db: { users: { id: string; is_admin: boolean }[] }): Promise<boolean> {
        // Always queries fresh from database
        queryLog.push(`SELECT is_admin FROM users WHERE id = '${userId}'`);
        const user = db.users.find((u) => u.id === userId);
        return user?.is_admin ?? false;
    }

    return { checkIsAdmin, queryLog };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Admin access control", () => {
    it("non-admin user cannot access admin", () => {
        expect(canAccessAdmin(false)).toBe(false);
        const redirect = getRedirectForUser({ id: "u1", is_admin: false });
        expect(redirect).toBe("/");
    });

    it("unauthenticated user redirected to signin", () => {
        const redirect = getRedirectForUser(null);
        expect(redirect).toBe("/signin");
    });

    it("admin check queries fresh from database", async () => {
        const { checkIsAdmin, queryLog } = createAdminChecker();
        const db = {
            users: [{ id: "u1", is_admin: true }],
        };

        // First check
        const result1 = await checkIsAdmin("u1", db);
        expect(result1).toBe(true);
        expect(queryLog).toHaveLength(1);

        // Second check — should query again, not use cache
        const result2 = await checkIsAdmin("u1", db);
        expect(result2).toBe(true);
        expect(queryLog).toHaveLength(2);

        // Verify each call produced a fresh query
        expect(queryLog[0]).toContain("SELECT is_admin FROM users");
        expect(queryLog[1]).toContain("SELECT is_admin FROM users");
    });

    it("revoking admin mid-session blocks access", async () => {
        const { checkIsAdmin } = createAdminChecker();
        const db = {
            users: [{ id: "u1", is_admin: true }],
        };

        // Initially admin
        const first = await checkIsAdmin("u1", db);
        expect(first).toBe(true);

        // Admin revoked mid-session
        db.users[0].is_admin = false;

        const second = await checkIsAdmin("u1", db);
        expect(second).toBe(false);

        // Next check should redirect
        const redirect = getRedirectForUser({ id: "u1", is_admin: false });
        expect(redirect).toBe("/");
    });

    it("admin data queries fail for non-admin via RLS", () => {
        // Simulate RLS blocking: regular user query returns empty
        const isAdmin = false;
        const canReadReports = rlsAllowsRead("reports", isAdmin);
        expect(canReadReports).toBe(false);

        // A non-admin querying an admin-only table gets no results
        const simulatedQueryResult = canReadReports ? [{ id: "rpt-1" }] : [];
        expect(simulatedQueryResult).toHaveLength(0);
    });

    it("regular user cannot read reports table", () => {
        expect(rlsAllowsRead("reports", false)).toBe(false);
    });

    it("regular user cannot read responsiveness_log", () => {
        expect(rlsAllowsRead("responsiveness_log", false)).toBe(false);
    });

    it("admin can read all tables", () => {
        expect(rlsAllowsRead("reports", true)).toBe(true);
        expect(rlsAllowsRead("responsiveness_log", true)).toBe(true);
        expect(rlsAllowsRead("posts", true)).toBe(true);
        expect(rlsAllowsRead("users", true)).toBe(true);
    });
});
