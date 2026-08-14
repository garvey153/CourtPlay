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
        // The icon alone was the whole instruction, and on current iOS it lives
        // behind ••• rather than in the toolbar.
        expect(screen.getByText("•••")).toBeInTheDocument();
        expect(screen.getByText("Share")).toBeInTheDocument();
        expect(screen.getByText("Add to Home Screen")).toBeInTheDocument();
    });
});
