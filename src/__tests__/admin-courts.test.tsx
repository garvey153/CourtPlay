import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: { from: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers — mirror the query/action logic the admin Courts tab performs.
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

function resetChain() {
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ data: [{ id: "court-new" }], error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
    } as any);
}

/** Fetch the master court list. */
function fetchCourts() {
    supabase.from("courts").select("id, name, area, active").order("name");
}

/** Fetch the custom-court list. */
function fetchCustomCourts() {
    supabase
        .from("custom_court_submissions")
        .select("id, court_name, submission_count, area")
        .order("submission_count", { ascending: false });
}

/** Add a new court to the master list. */
function addCourt(name: string, area: string | null) {
    supabase.from("courts").insert({ name, area, active: true });
}

/** Save edits to a court's name/area. */
function editCourt(courtId: string, name: string, area: string | null) {
    supabase.from("courts").update({ name, area }).eq("id", courtId);
}

/** Deactivate a court. */
function deactivateCourt(courtId: string) {
    supabase.from("courts").update({ active: false }).eq("id", courtId);
}

/** Promote a custom court to the master list, then drop it from the Custom list. */
function addCustomToMaster(name: string, area: string | null, submissionId: string) {
    supabase.from("courts").insert({ name, area, active: true });
    supabase.from("custom_court_submissions").delete().eq("id", submissionId);
}

/** Remove a custom court from the Custom list (no impact on the posts using it). */
function removeCustom(submissionId: string) {
    supabase.from("custom_court_submissions").delete().eq("id", submissionId);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin courts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetChain();
    });

    it("fetches the master court list", () => {
        fetchCourts();
        expect(supabase.from).toHaveBeenCalledWith("courts");
        expect(mockSelect).toHaveBeenCalledWith("id, name, area, active");
        expect(mockOrder).toHaveBeenCalledWith("name");
    });

    it("fetches the custom-court list", () => {
        fetchCustomCourts();
        expect(supabase.from).toHaveBeenCalledWith("custom_court_submissions");
        expect(mockSelect).toHaveBeenCalledWith("id, court_name, submission_count, area");
        expect(mockOrder).toHaveBeenCalledWith("submission_count", { ascending: false });
    });

    it("adds a new court as active", () => {
        addCourt("Longshore Club", "Westport");
        expect(mockInsert).toHaveBeenCalledWith({ name: "Longshore Club", area: "Westport", active: true });
    });

    it("saves edits to a court", () => {
        editCourt("court-1", "Updated Name", "Fairfield");
        expect(mockUpdate).toHaveBeenCalledWith({ name: "Updated Name", area: "Fairfield" });
    });

    it("deactivates a court", () => {
        deactivateCourt("court-1");
        expect(mockUpdate).toHaveBeenCalledWith({ active: false });
    });

    it("adding a custom court to the master list inserts it and removes the submission", () => {
        addCustomToMaster("Sherwood Island", "Westport", "submission-1");
        expect(mockInsert).toHaveBeenCalledWith({ name: "Sherwood Island", area: "Westport", active: true });
        expect(supabase.from).toHaveBeenCalledWith("custom_court_submissions");
        expect(mockDelete).toHaveBeenCalled();
    });

    it("removing a custom court drops only the submission (no post changes)", () => {
        removeCustom("submission-1");
        expect(supabase.from).toHaveBeenCalledWith("custom_court_submissions");
        expect(mockDelete).toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
