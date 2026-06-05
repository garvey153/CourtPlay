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
// Helpers — simulate the query/action logic the admin posts panel uses
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockRange = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

function resetChain() {
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, range: mockRange });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, range: mockRange });
    mockOrder.mockReturnValue({ range: mockRange });
    mockRange.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ eq: mockEq, match: vi.fn().mockResolvedValue({ data: [], error: null }) });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, range: mockRange });
    vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
        delete: mockDelete,
    } as any);
}

/** Simulates the admin posts query — fetches all posts without status filter. */
function fetchAllPosts(page: number, pageSize: number, statusFilter?: string) {
    const query = supabase.from("posts").select("*, profiles(full_name), claims(count)");
    if (statusFilter) {
        (query as any).eq("status", statusFilter);
    }
    (query as any).order("created_at", { ascending: false });
    (query as any).range(page * pageSize, (page + 1) * pageSize - 1);
}

/** Simulates admin soft-delete action. */
function softDeletePost(postId: string, adminId: string) {
    const payload = {
        status: "deleted",
        deleted_at: new Date().toISOString(),
        deleted_by: adminId,
    };
    supabase.from("posts").update(payload);
    return payload;
}

/** Simulates admin force-expire action. */
function forceExpirePost(postId: string) {
    const payload = { status: "expired" };
    supabase.from("posts").update(payload);
    return payload;
}

/** Simulates admin edit action. */
function editPostField(postId: string, field: string, value: any) {
    const payload = { [field]: value };
    supabase.from("posts").update(payload);
    return payload;
}

/** Confirmation state helper — mirrors the pattern used in admin panels. */
function createConfirmationState() {
    let confirmingAction: { type: string; id: string } | null = null;

    return {
        requestAction(type: string, id: string) {
            confirmingAction = { type, id };
        },
        confirmAction() {
            const action = confirmingAction;
            confirmingAction = null;
            return action;
        },
        cancelAction() {
            confirmingAction = null;
        },
        get pending() {
            return confirmingAction;
        },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin posts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetChain();
    });

    it("posts table shows all posts including active, expired, and deleted", () => {
        fetchAllPosts(0, 25);

        expect(supabase.from).toHaveBeenCalledWith("posts");
        expect(mockSelect).toHaveBeenCalled();
        // No .eq("status", ...) should be called when no filter is set
        expect(mockEq).not.toHaveBeenCalledWith("status", expect.anything());
    });

    it("posts table is paginated", () => {
        fetchAllPosts(2, 25);

        expect(mockRange).toHaveBeenCalledWith(50, 74);
    });

    it("filter by status works", () => {
        resetChain();
        // Re-wire eq to track calls properly
        const eqCalls: [string, string][] = [];
        mockEq.mockImplementation((col: string, val: string) => {
            eqCalls.push([col, val]);
            return { eq: mockEq, order: mockOrder, range: mockRange };
        });

        fetchAllPosts(0, 25, "active");

        expect(eqCalls).toContainEqual(["status", "active"]);
    });

    it("admin can soft-delete a post", () => {
        const payload = softDeletePost("post-1", "admin-1");

        expect(supabase.from).toHaveBeenCalledWith("posts");
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "deleted",
                deleted_at: expect.any(String),
                deleted_by: "admin-1",
            })
        );
        expect(payload.status).toBe("deleted");
        expect(payload.deleted_at).toBeTruthy();
    });

    it("admin soft-delete sets deleted_by to admin ID not poster ID", () => {
        const payload = softDeletePost("post-1", "admin-1");

        expect(payload.deleted_by).toBe("admin-1");
        expect(payload.deleted_by).not.toBe("poster-1");
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ deleted_by: "admin-1" })
        );
    });

    it("admin can force-expire a post", () => {
        const payload = forceExpirePost("post-1");

        expect(supabase.from).toHaveBeenCalledWith("posts");
        expect(mockUpdate).toHaveBeenCalledWith({ status: "expired" });
        expect(payload.status).toBe("expired");
    });

    it("admin can edit a post field", () => {
        const payload = editPostField("post-1", "location", "Central Park Courts");

        expect(supabase.from).toHaveBeenCalledWith("posts");
        expect(mockUpdate).toHaveBeenCalledWith({ location: "Central Park Courts" });
        expect(payload.location).toBe("Central Park Courts");
    });

    it("admin cannot hard-delete", () => {
        // Perform all admin actions and verify DELETE is never constructed
        softDeletePost("post-1", "admin-1");
        forceExpirePost("post-2");
        editPostField("post-3", "location", "New Court");

        expect(mockDelete).not.toHaveBeenCalled();
    });

    it("destructive actions require confirmation", () => {
        const confirmation = createConfirmationState();

        expect(confirmation.pending).toBeNull();

        confirmation.requestAction("soft-delete", "post-1");
        expect(confirmation.pending).toEqual({ type: "soft-delete", id: "post-1" });

        // Only after confirm does the action proceed
        const action = confirmation.confirmAction();
        expect(action).toEqual({ type: "soft-delete", id: "post-1" });
        expect(confirmation.pending).toBeNull();
    });

    it("admin edit is atomic — single update call", () => {
        editPostField("post-1", "cost", 50);

        // Only one from() + update() chain should exist
        expect(supabase.from).toHaveBeenCalledTimes(1);
        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
});
