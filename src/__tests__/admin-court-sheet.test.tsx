import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCourtSheet } from "@/pages/admin/admin-court-sheet";
import type { AdminCourtRow, CustomCourtRow } from "@/pages/admin/admin-court-card";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

const COURT: AdminCourtRow = { id: "c1", name: "Longshore", area: "Westport", active: true };
const CUSTOM: CustomCourtRow = { id: "s1", court_name: "Compo Beach", area: "Westport", submission_count: 3 };

/**
 * The sheet drives three flows through one form, and the primary button means a
 * different thing in each. Editing writes to an existing row, so it says "Save
 * changes" — matching every other save in the app — and stays disabled until
 * there is a change to save. The other two ADD a row and are enabled on a name
 * alone: create starts empty, and custom is prefilled exactly so it can be
 * promoted as-is.
 */
describe("AdminCourtSheet — primary button", () => {
    const open = (target: React.ComponentProps<typeof AdminCourtSheet>["target"]) =>
        render(<AdminCourtSheet target={target} onClose={vi.fn()} onSaved={vi.fn()} />);

    const save = () => screen.getByRole("button", { name: "Save changes" });

    beforeEach(() => vi.clearAllMocks());

    it("editing reads 'Save changes', not 'Save'", () => {
        open({ mode: "court", court: COURT });
        expect(save()).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Save$/ })).not.toBeInTheDocument();
    });

    it("editing starts disabled — nothing has changed yet", () => {
        open({ mode: "court", court: COURT });
        expect(save()).toBeDisabled();
    });

    it("editing the name enables it", async () => {
        const user = userEvent.setup();
        open({ mode: "court", court: COURT });
        await user.type(screen.getByDisplayValue("Longshore"), "!");
        expect(save()).toBeEnabled();
    });

    it("editing the area alone enables it", async () => {
        const user = userEvent.setup();
        open({ mode: "court", court: COURT });
        await user.type(screen.getByDisplayValue("Westport"), "!");
        expect(save()).toBeEnabled();
    });

    it("typing and undoing leaves it disabled — back to the original is not a change", async () => {
        const user = userEvent.setup();
        open({ mode: "court", court: COURT });
        const name = screen.getByDisplayValue("Longshore");
        await user.type(name, "!");
        expect(save()).toBeEnabled();
        await user.type(name, "{backspace}");
        expect(save()).toBeDisabled();
    });

    it("whitespace is not a change: handleSave trims, so the write would be a no-op", async () => {
        const user = userEvent.setup();
        open({ mode: "court", court: COURT });
        await user.type(screen.getByDisplayValue("Longshore"), "   ");
        expect(save()).toBeDisabled();
    });

    it("clearing the name disables it — a court needs one", async () => {
        const user = userEvent.setup();
        open({ mode: "court", court: COURT });
        await user.clear(screen.getByDisplayValue("Longshore"));
        expect(save()).toBeDisabled();
    });

    it("a court with no area still starts disabled (null area vs empty field)", () => {
        open({ mode: "court", court: { ...COURT, area: null } });
        expect(save()).toBeDisabled();
    });

    it("create says 'Add court' and needs only a name — there is nothing to diff against", async () => {
        const user = userEvent.setup();
        open({ mode: "create" });
        const add = () => screen.getByRole("button", { name: "Add court" });
        expect(add()).toBeDisabled();
        await user.type(screen.getByPlaceholderText("e.g. Longshore Tennis Club"), "Compo");
        expect(add()).toBeEnabled();
    });

    it("custom is enabled as it opens — prefilled so it can be promoted untouched", () => {
        open({ mode: "custom", custom: CUSTOM });
        expect(screen.getByRole("button", { name: "Add court" })).toBeEnabled();
    });
});
