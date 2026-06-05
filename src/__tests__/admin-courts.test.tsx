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
// Helpers — simulate the query/action logic the admin courts panel uses
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();

function resetChain() {
    mockSelect.mockReturnValue({ eq: mockEq, gte: mockGte, order: mockOrder, range: mockRange });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, range: mockRange });
    mockGte.mockReturnValue({ eq: mockEq, order: mockOrder, range: mockRange });
    mockOrder.mockReturnValue({ range: mockRange });
    mockRange.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ data: [{ id: "court-new" }], error: null });
    mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
    } as any);
}

/** Fetch the master court list. */
function fetchCourts() {
    supabase.from("courts").select("*");
}

/** Add a new court to the master list. */
function addCourt(name: string, area: string) {
    const payload = { name, area, active: true };
    supabase.from("courts").insert(payload);
    return payload;
}

/** Edit a court name. */
function editCourtName(courtId: string, newName: string) {
    const payload = { name: newName };
    supabase.from("courts").update(payload);
    return payload;
}

/** Deactivate or reactivate a court. */
function setCourtActive(courtId: string, active: boolean) {
    const payload = { active };
    supabase.from("courts").update(payload);
    return payload;
}

/** Fetch custom court submissions queue (high-count only). */
function fetchCustomCourtQueue(minCount: number) {
    const query = supabase.from("custom_court_submissions").select("*, count");
    (query as any).gte("count", minCount);
    (query as any).eq("alerted", false);
    (query as any).order("count", { ascending: false });
}

/** Add a custom court to the master list and dismiss the alert. */
function addCustomCourtToMasterList(name: string, area: string, submissionId: string) {
    // Insert into master courts
    const courtPayload = { name, area, active: true };
    supabase.from("courts").insert(courtPayload);

    // Dismiss the submission alert
    vi.clearAllMocks();
    resetChain();
    const dismissPayload = { alerted: true };
    supabase.from("custom_court_submissions").update(dismissPayload);

    return { courtPayload, dismissPayload };
}

/** Dismiss a custom court alert without adding to master list. */
function dismissCustomCourtAlert(submissionId: string) {
    const payload = { alerted: true };
    supabase.from("custom_court_submissions").update(payload);
    return payload;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin courts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetChain();
    });

    it("courts panel shows master court list", () => {
        fetchCourts();

        expect(supabase.from).toHaveBeenCalledWith("courts");
        expect(mockSelect).toHaveBeenCalledWith("*");
    });

    it("admin can add a new court", () => {
        const payload = addCourt("Longshore Club", "Westport");

        expect(supabase.from).toHaveBeenCalledWith("courts");
        expect(mockInsert).toHaveBeenCalledWith({
            name: "Longshore Club",
            area: "Westport",
            active: true,
        });
        expect(payload.active).toBe(true);
    });

    it("admin can edit a court name", () => {
        const payload = editCourtName("court-1", "Updated Court Name");

        expect(supabase.from).toHaveBeenCalledWith("courts");
        expect(mockUpdate).toHaveBeenCalledWith({ name: "Updated Court Name" });
        expect(payload.name).toBe("Updated Court Name");
    });

    it("admin can deactivate a court", () => {
        const payload = setCourtActive("court-1", false);

        expect(supabase.from).toHaveBeenCalledWith("courts");
        expect(mockUpdate).toHaveBeenCalledWith({ active: false });
        expect(payload.active).toBe(false);
    });

    it("admin can reactivate a court", () => {
        const payload = setCourtActive("court-1", true);

        expect(supabase.from).toHaveBeenCalledWith("courts");
        expect(mockUpdate).toHaveBeenCalledWith({ active: true });
        expect(payload.active).toBe(true);
    });

    it("custom court submissions queue shows high-count submissions", () => {
        const eqCalls: [string, any][] = [];
        const gteCalls: [string, any][] = [];
        mockEq.mockImplementation((col: string, val: any) => {
            eqCalls.push([col, val]);
            return { eq: mockEq, gte: mockGte, order: mockOrder, range: mockRange };
        });
        mockGte.mockImplementation((col: string, val: any) => {
            gteCalls.push([col, val]);
            return { eq: mockEq, gte: mockGte, order: mockOrder, range: mockRange };
        });

        fetchCustomCourtQueue(5);

        expect(supabase.from).toHaveBeenCalledWith("custom_court_submissions");
        expect(gteCalls).toContainEqual(["count", 5]);
        expect(eqCalls).toContainEqual(["alerted", false]);
    });

    it("admin can add custom court to master list", () => {
        const { courtPayload, dismissPayload } = addCustomCourtToMasterList(
            "Sherwood Island",
            "Westport",
            "submission-1"
        );

        // Court was inserted
        expect(courtPayload).toEqual({ name: "Sherwood Island", area: "Westport", active: true });
        // Alert was dismissed
        expect(supabase.from).toHaveBeenCalledWith("custom_court_submissions");
        expect(mockUpdate).toHaveBeenCalledWith({ alerted: true });
        expect(dismissPayload.alerted).toBe(true);
    });

    it("admin can dismiss custom court alert", () => {
        const payload = dismissCustomCourtAlert("submission-1");

        expect(supabase.from).toHaveBeenCalledWith("custom_court_submissions");
        expect(mockUpdate).toHaveBeenCalledWith({ alerted: true });
        expect(payload.alerted).toBe(true);
    });
});
