import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClosedBadge } from "@/components/app/closed-badge";

/**
 * design-system 95:212. The colours were already right where this badge was
 * hand-rolled — the design's `status/error-bg` #7a271a is this theme's red-900
 * and `status/error_badge` #f97066 is red-400 — so what these pin is the part
 * that was missing: 4px of vertical padding rather than 2.
 *
 * The dot the design draws is deliberately NOT here. Status badges across the
 * app dropped theirs — the badge's own background and text colour already carry
 * the state — and this one was simply missed at the time, because its dot
 * carried an extra class the sweep grepped past.
 */
describe("ClosedBadge", () => {
    it("carries no dot, like every other status badge", () => {
        const { container } = render(<ClosedBadge />);
        expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
        expect(container.querySelector(".rounded-full")).toBeNull();
    });

    it("uses the design's fill, text and padding", () => {
        render(<ClosedBadge />);
        const badge = screen.getByText("Closed");
        expect(badge.className).toContain("bg-red-900");
        expect(badge.className).toContain("text-red-400");
        expect(badge.className).toContain("px-2");
        expect(badge.className).toContain("py-1");
        expect(badge.className).not.toContain("py-0.5");
        expect(badge.className).toContain("gap-1");
    });

    it("takes a className, since the sheet needs its own top margin", () => {
        render(<ClosedBadge className="mt-1" />);
        expect(screen.getByText("Closed").className).toContain("mt-1");
    });
});
