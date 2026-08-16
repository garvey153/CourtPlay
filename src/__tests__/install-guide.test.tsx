import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InstallGuide } from "@/components/app/install-guide";

vi.mock("@/utils/is-ios", () => ({ isIos: () => true }));

/**
 * The guide opened onto a blank screen, with the dialog reachable only by
 * scrolling. `fixed inset-0` sized itself to the feed rather than the viewport,
 * because the feed wraps its content in PullToRefresh and a transformed
 * ancestor becomes the containing block for fixed descendants.
 *
 * These render the guide inside exactly that shape and assert it escapes.
 */
describe("InstallGuide", () => {
    const inTransformedParent = () => {
        const { container } = render(
            <div style={{ transform: "translateY(0px)" }}>
                <InstallGuide onClose={vi.fn()} />
            </div>,
        );
        return container;
    };

    it("escapes a transformed ancestor by portalling to the body", () => {
        const container = inTransformedParent();
        const dialog = screen.getByRole("dialog", { name: "Install CourtPlay" });

        // Not inside the transformed wrapper, which is what made `fixed` measure
        // against the feed instead of the viewport.
        expect(container.contains(dialog)).toBe(false);
        expect(document.body.contains(dialog)).toBe(true);
    });

    it("dims and blurs like the bottom sheets", () => {
        inTransformedParent();
        const dialog = screen.getByRole("dialog", { name: "Install CourtPlay" });
        expect(dialog.className).toContain("backdrop-blur-[8px]");
        expect(dialog.querySelector(".bg-black\\/60")).not.toBeNull();
    });

    it("names the overflow menu, not just the Share icon", () => {
        inTransformedParent();
        // The Share icon alone used to be the whole instruction, and on current
        // iOS that action lives behind the ••• menu rather than in the toolbar.
        // The wording changed with the redesign; the requirement did not.
        const text = document.body.textContent ?? "";
        expect(text).toContain("Safari's toolbar");
        expect(text).toContain("Tap Share at the top of the menu");
        expect(text).toContain("Add to Home Screen");
    });

    /** Figma 659:2070 — a bottom sheet, not the centred card it used to be. */
    describe("bottom sheet (659:2070)", () => {
        it("anchors to the bottom of the screen", () => {
            inTransformedParent();
            const dialog = screen.getByRole("dialog", { name: "Install CourtPlay" });
            expect(dialog.className).toContain("items-end");

            const sheet = dialog.querySelector(".rounded-t-2xl");
            expect(sheet).not.toBeNull();
        });

        it("has a Done button that closes it", async () => {
            const onClose = vi.fn();
            render(
                <div style={{ transform: "translateY(0px)" }}>
                    <InstallGuide onClose={onClose} />
                </div>,
            );
            const done = screen.getByRole("button", { name: "Done" });
            expect(done.className).toContain("bg-brand-500");
            done.click();
            expect(onClose).toHaveBeenCalled();
        });

        it("shows all four iOS steps", () => {
            inTransformedParent();
            expect(screen.getAllByRole("listitem")).toHaveLength(4);
        });

        /** The safe-area pad lives on the sheet: a fixed sheet is outside the
         *  layout that would otherwise apply the home-indicator inset. */
        it("pads for the home indicator", () => {
            inTransformedParent();
            const dialog = screen.getByRole("dialog", { name: "Install CourtPlay" });
            const sheet = dialog.querySelector(".rounded-t-2xl") as HTMLElement;
            expect(sheet.className).toContain("--safe-bottom");
        });
    });
});
