import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchField } from "@/components/base/input/search-field";

/**
 * One component replacing nine hand-rolled copies. The variant is the part
 * worth pinning: it is chosen by the SURFACE behind the field, and the two
 * token sets are a single step apart in the palette — outline's border and
 * filled's fill are literally the same hex in different roles, so a swap is
 * invisible to review and nearly invisible on screen.
 */
describe("SearchField", () => {
    const container = (el: HTMLElement) => el.closest("div")!;

    it("shows no clear button until there is a value", () => {
        const { rerender } = render(<SearchField value="" onChange={vi.fn()} placeholder="Search groups" />);
        expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

        rerender(<SearchField value="rac" onChange={vi.fn()} placeholder="Search groups" />);
        expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    });

    it("clearing empties the field through onChange", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<SearchField value="rac" onChange={onChange} placeholder="Search groups" />);
        await user.click(screen.getByRole("button", { name: "Clear search" }));
        expect(onChange).toHaveBeenCalledWith("");
    });

    it("reports typing as the whole value, not a keystroke", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<SearchField value="" onChange={onChange} placeholder="Search groups" />);
        await user.type(screen.getByPlaceholderText("Search groups"), "a");
        expect(onChange).toHaveBeenCalledWith("a");
    });

    it("outline is the default: a border, no fill", () => {
        render(<SearchField value="" onChange={vi.fn()} placeholder="Search" />);
        const el = container(screen.getByPlaceholderText("Search"));
        expect(el.className).toContain("border-primary");
        expect(el.className).not.toContain("bg-tertiary");
    });

    it("filled carries both a fill and its own border token", () => {
        render(<SearchField value="" onChange={vi.fn()} variant="filled" placeholder="Search" />);
        const el = container(screen.getByPlaceholderText("Search"));
        expect(el.className).toContain("bg-tertiary");
        // neutral-600 (#4d5f53), NOT border-tertiary — Figma's "border/tertiary"
        // is #4d5f53 but this app's token of that name is #26382c, which is the
        // fill colour. Pinned by value; matching the names silently gives a
        // border the same colour as the fill.
        expect(el.className).toContain("border-neutral-600");
        expect(el.className).not.toContain("border-primary");
    });

    it("passes className through for layout — admin rows need flex-1", () => {
        render(<SearchField value="" onChange={vi.fn()} className="flex-1" placeholder="Search" />);
        expect(container(screen.getByPlaceholderText("Search")).className).toContain("flex-1");
    });

    it("forwards onFocus, which is how onboarding reopens its typeahead", async () => {
        const onFocus = vi.fn();
        const user = userEvent.setup();
        render(<SearchField value="ab" onChange={vi.fn()} onFocus={onFocus} placeholder="Search" />);
        await user.click(screen.getByPlaceholderText("Search"));
        expect(onFocus).toHaveBeenCalled();
    });

    it("takes an id, so a caller's htmlFor label still binds", () => {
        render(<SearchField id="group-member-search" value="" onChange={vi.fn()} placeholder="Search" />);
        expect(screen.getByPlaceholderText("Search")).toHaveAttribute("id", "group-member-search");
    });
});
