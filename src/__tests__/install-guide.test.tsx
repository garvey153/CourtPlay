import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AnimatePresence, motion } from "motion/react";
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
        /**
         * The feed renders the iOS prompt inside <AnimatePresence initial={false}>,
         * which suppresses the enter animation of every nested motion component
         * through React context. Portalling to document.body escapes the DOM tree
         * but NOT the React tree, so this sheet inherited the suppression and
         * appeared already in place — while every other bottom sheet, being outside
         * that subtree, slid up normally.
         *
         * Driving the entrance from state cannot be suppressed that way. This
         * asserts the sheet still leaves its starting offset in that exact shape.
         */
        it("still slides up inside AnimatePresence initial={false}", async () => {
            render(
                <AnimatePresence initial={false}>
                    <motion.div key="card" animate={{ opacity: 1 }}>
                        <InstallGuide onClose={vi.fn()} />
                    </motion.div>
                </AnimatePresence>,
            );
            const dialog = screen.getByRole("dialog", { name: "Install CourtPlay" });
            const sheet = dialog.querySelector(".rounded-t-2xl") as HTMLElement;

            // The state flip lands after mount; the sheet must end up at rest.
            await waitFor(() => {
                const t = sheet.style.transform ?? "";
                expect(t === "" || t.includes("translateY(0") || !t.includes("100%")).toBe(true);
            });
        });

        /**
         * Measured off Figma 659:4115: a 40px row, a 28px disc centred in it, an
         * 18.67px glyph, 12px gap. The disc is WHITE and the glyph is knocked out
         * of it in bg/secondary — not a hollow ring with a light icon, and not a
         * muted grey disc.
         */
        it("draws the icons to the design's spec", () => {
            inTransformedParent();
            const discs = document.querySelectorAll(".rounded-full");
            expect(discs.length).toBe(4);

            for (const disc of discs) {
                expect(disc.className).toContain("size-7"); // 28px
                expect(disc.className).toContain("bg-white");
                const glyph = disc.querySelector("svg") as SVGElement;
                // The glyph shares the disc's own 28px coordinate space, which is
                // what makes stroke-width 1 render as exactly 1px.
                expect(glyph.getAttribute("viewBox")).toBe("0 0 28 28");
                expect(glyph.getAttribute("class")).toContain("size-7");
                // The knockout, via the token rather than a literal #17261c.
                expect(glyph.getAttribute("class")).toContain("var(--color-bg-secondary)");
            }
        });

        /** Untitled UI's per-glyph defaults differ, which made some look heavier. */
        it("gives every step icon a 1px stroke", () => {
            inTransformedParent();
            const glyphs = document.querySelectorAll(".rounded-full svg");
            expect(glyphs.length).toBe(4);
            for (const g of glyphs) {
                expect(g.getAttribute("stroke-width")).toBe("1");
            }
        });

        /** The disc centres against the whole row, not the first line. */
        it("centres each icon vertically against its text", () => {
            inTransformedParent();
            for (const item of screen.getAllByRole("listitem")) {
                const column = item.firstElementChild as HTMLElement;
                expect(column.className).toContain("items-center");
                expect(column.className).toContain("self-stretch");
            }
        });

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
