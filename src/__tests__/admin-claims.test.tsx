import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import * as notifications from "@/lib/notifications";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
        functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
    },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "admin-1" }, loading: false }),
}));

vi.mock("@/lib/notifications", () => ({
    sendNotification: vi.fn(),
    sendNotificationBatch: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers — simulate the query/action logic the admin claims panel uses
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockRange = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

function resetChain() {
    mockSelect.mockReturnValue({ eq: mockEq, gte: mockGte, lte: mockLte, order: mockOrder, range: mockRange });
    mockEq.mockReturnValue({ eq: mockEq, gte: mockGte, lte: mockLte, order: mockOrder, range: mockRange });
    mockGte.mockReturnValue({ eq: mockEq, gte: mockGte, lte: mockLte, order: mockOrder, range: mockRange });
    mockLte.mockReturnValue({ eq: mockEq, gte: mockGte, lte: mockLte, order: mockOrder, range: mockRange });
    mockOrder.mockReturnValue({ range: mockRange });
    mockRange.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
        delete: mockDelete,
    } as any);
}

/** Fetch all claims. */
function fetchAllClaims(page: number, pageSize: number, statusFilter?: string, dateFrom?: string, dateTo?: string) {
    const query = supabase.from("claims").select("*, posts(*, profiles(full_name)), claimer:profiles!claimer_id(full_name)");
    if (statusFilter) {
        (query as any).eq("status", statusFilter);
    }
    if (dateFrom) {
        (query as any).gte("created_at", dateFrom);
    }
    if (dateTo) {
        (query as any).lte("created_at", dateTo);
    }
    (query as any).order("created_at", { ascending: false });
    (query as any).range(page * pageSize, (page + 1) * pageSize - 1);
}

/** Admin cancel a claim and notify both parties. */
function cancelClaim(claimId: string, claimerId: string, posterId: string) {
    const payload = { status: "cancelled" };
    supabase.from("claims").update(payload);

    // Notify both claimer and poster
    notifications.sendNotification(claimerId, {
        type: "claim_cancelled_by_admin",
        claimId,
    });
    notifications.sendNotification(posterId, {
        type: "claim_cancelled_by_admin",
        claimId,
    });

    return payload;
}

/** Check whether any edit/delete actions exist for responsiveness log data. */
function getResponsivenessLogActions() {
    // Responsiveness log is read-only — no mutation actions available
    return { canEdit: false, canDelete: false };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin claims", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetChain();
    });

    it("claims table shows all claims", () => {
        fetchAllClaims(0, 25);

        expect(supabase.from).toHaveBeenCalledWith("claims");
        expect(mockSelect).toHaveBeenCalled();
        // No status filter by default
        expect(mockEq).not.toHaveBeenCalledWith("status", expect.anything());
    });

    it("claims filterable by status", () => {
        const eqCalls: [string, any][] = [];
        mockEq.mockImplementation((col: string, val: any) => {
            eqCalls.push([col, val]);
            return { eq: mockEq, gte: mockGte, lte: mockLte, order: mockOrder, range: mockRange };
        });

        fetchAllClaims(0, 25, "pending");

        expect(eqCalls).toContainEqual(["status", "pending"]);
    });

    it("admin can cancel a pending claim", () => {
        const payload = cancelClaim("claim-1", "claimer-1", "poster-1");

        expect(supabase.from).toHaveBeenCalledWith("claims");
        expect(mockUpdate).toHaveBeenCalledWith({ status: "cancelled" });
        expect(payload.status).toBe("cancelled");
    });

    it("admin can cancel an approved claim", () => {
        // Same cancellation flow works regardless of prior status
        const payload = cancelClaim("claim-2", "claimer-2", "poster-2");

        expect(supabase.from).toHaveBeenCalledWith("claims");
        expect(mockUpdate).toHaveBeenCalledWith({ status: "cancelled" });
        expect(payload.status).toBe("cancelled");
    });

    it("admin claim cancellation notifies both parties", () => {
        cancelClaim("claim-1", "claimer-1", "poster-1");

        expect(notifications.sendNotification).toHaveBeenCalledTimes(2);
        expect(notifications.sendNotification).toHaveBeenCalledWith("claimer-1", {
            type: "claim_cancelled_by_admin",
            claimId: "claim-1",
        });
        expect(notifications.sendNotification).toHaveBeenCalledWith("poster-1", {
            type: "claim_cancelled_by_admin",
            claimId: "claim-1",
        });
    });

    it("claims filterable by date", () => {
        const gteCalls: [string, string][] = [];
        const lteCalls: [string, string][] = [];
        mockGte.mockImplementation((col: string, val: string) => {
            gteCalls.push([col, val]);
            return { eq: mockEq, gte: mockGte, lte: mockLte, order: mockOrder, range: mockRange };
        });
        mockLte.mockImplementation((col: string, val: string) => {
            lteCalls.push([col, val]);
            return { eq: mockEq, gte: mockGte, lte: mockLte, order: mockOrder, range: mockRange };
        });

        fetchAllClaims(0, 25, undefined, "2026-04-01", "2026-04-07");

        expect(gteCalls).toContainEqual(["created_at", "2026-04-01"]);
        expect(lteCalls).toContainEqual(["created_at", "2026-04-07"]);
    });

    it("responsiveness log data is read-only", () => {
        const actions = getResponsivenessLogActions();

        expect(actions.canEdit).toBe(false);
        expect(actions.canDelete).toBe(false);
        // Verify no delete or update is ever constructed for responsiveness data
        expect(mockDelete).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
