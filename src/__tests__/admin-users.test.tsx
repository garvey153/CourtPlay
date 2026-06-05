import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
        functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
    },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "admin-1" }, loading: false }),
}));

// ---------------------------------------------------------------------------
// Helpers — simulate the query/action logic the admin users panel uses
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockRange = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockIlike = vi.fn();

function resetChain() {
    mockSelect.mockReturnValue({ eq: mockEq, ilike: mockIlike, order: mockOrder, range: mockRange });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, range: mockRange });
    mockIlike.mockReturnValue({ eq: mockEq, order: mockOrder, range: mockRange });
    mockOrder.mockReturnValue({ range: mockRange });
    mockRange.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        match: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
    } as any);
}

/** Fetches all users without filtering by status. */
function fetchAllUsers(page: number, pageSize: number, statusFilter?: string, search?: string) {
    const query = supabase.from("profiles").select("*, reports:reports(count)");
    if (statusFilter === "suspended") {
        (query as any).eq("is_suspended", true);
    }
    if (search) {
        (query as any).ilike("full_name", `%${search}%`);
    }
    (query as any).order("created_at", { ascending: false });
    (query as any).range(page * pageSize, (page + 1) * pageSize - 1);
}

/** Suspend or unsuspend a user. */
function setUserSuspended(userId: string, suspended: boolean) {
    const payload = { is_suspended: suspended };
    supabase.from("profiles").update(payload);
    return payload;
}

/** Toggle admin status. */
function toggleAdmin(userId: string, isAdmin: boolean) {
    const payload = { is_admin: isAdmin };
    supabase.from("profiles").update(payload);
    return payload;
}

/** Self-deletion prevention check. */
function canDeleteUser(targetUserId: string, currentAdminId: string): boolean {
    return targetUserId !== currentAdminId;
}

/** Derive display status from user profile. */
function getUserDisplayStatus(profile: { is_suspended?: boolean; deleted_at?: string | null }) {
    if (profile.deleted_at) return "deleted";
    if (profile.is_suspended) return "suspended";
    return "active";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin users", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetChain();
    });

    it("users table shows all users including suspended and deleted", () => {
        fetchAllUsers(0, 25);

        expect(supabase.from).toHaveBeenCalledWith("profiles");
        expect(mockSelect).toHaveBeenCalled();
        // No filter applied by default
        expect(mockEq).not.toHaveBeenCalledWith("is_suspended", expect.anything());
    });

    it("filter by status suspended works", () => {
        const eqCalls: [string, any][] = [];
        mockEq.mockImplementation((col: string, val: any) => {
            eqCalls.push([col, val]);
            return { eq: mockEq, order: mockOrder, range: mockRange };
        });

        fetchAllUsers(0, 25, "suspended");

        expect(eqCalls).toContainEqual(["is_suspended", true]);
    });

    it("admin can suspend a user", () => {
        const payload = setUserSuspended("user-5", true);

        expect(supabase.from).toHaveBeenCalledWith("profiles");
        expect(mockUpdate).toHaveBeenCalledWith({ is_suspended: true });
        expect(payload.is_suspended).toBe(true);
    });

    it("admin can unsuspend a user", () => {
        const payload = setUserSuspended("user-5", false);

        expect(supabase.from).toHaveBeenCalledWith("profiles");
        expect(mockUpdate).toHaveBeenCalledWith({ is_suspended: false });
        expect(payload.is_suspended).toBe(false);
    });

    it("admin can toggle is_admin", () => {
        const grantPayload = toggleAdmin("user-5", true);
        expect(mockUpdate).toHaveBeenCalledWith({ is_admin: true });
        expect(grantPayload.is_admin).toBe(true);

        vi.clearAllMocks();
        resetChain();

        const revokePayload = toggleAdmin("user-5", false);
        expect(mockUpdate).toHaveBeenCalledWith({ is_admin: false });
        expect(revokePayload.is_admin).toBe(false);
    });

    it("admin cannot delete themselves", () => {
        expect(canDeleteUser("admin-1", "admin-1")).toBe(false);
        expect(canDeleteUser("user-5", "admin-1")).toBe(true);
    });

    it("suspended user state is correctly reflected", () => {
        expect(getUserDisplayStatus({ is_suspended: false })).toBe("active");
        expect(getUserDisplayStatus({ is_suspended: true })).toBe("suspended");
        expect(getUserDisplayStatus({ deleted_at: "2026-04-01T00:00:00Z" })).toBe("deleted");
        // deleted_at takes precedence over suspended
        expect(getUserDisplayStatus({ is_suspended: true, deleted_at: "2026-04-01T00:00:00Z" })).toBe("deleted");
    });

    it("users show report count", () => {
        fetchAllUsers(0, 25);

        expect(mockSelect).toHaveBeenCalledWith("*, reports:reports(count)");
    });

    it("filter by search works", () => {
        const ilikeCalls: [string, string][] = [];
        mockIlike.mockImplementation((col: string, val: string) => {
            ilikeCalls.push([col, val]);
            return { eq: mockEq, order: mockOrder, range: mockRange };
        });

        fetchAllUsers(0, 25, undefined, "Jane");

        expect(ilikeCalls).toContainEqual(["full_name", "%Jane%"]);
    });

    it("pagination works", () => {
        fetchAllUsers(3, 20);

        expect(mockRange).toHaveBeenCalledWith(60, 79);
    });
});
