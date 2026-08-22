import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/components/base/buttons/cta";

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

/**
 * Every page's empty state routes through this one component, so the tone is
 * settled here rather than at eleven call sites — and so is this test. If the
 * default ever flips back, every page flips with it and this is what notices.
 */
describe("area-state calls to action", () => {
    it("gives an empty state's link the secondary CTA", () => {
        wrap(<EmptyState title="Nothing yet" actionLabel="Find a sub" href="/feed" />);
        const cta = screen.getByRole("link", { name: "Find a sub" });
        expect(cta.className).toContain(SECONDARY_CTA);
        expect(cta.className).not.toContain(PRIMARY_CTA);
    });

    it("gives an empty state's button the secondary CTA too", () => {
        wrap(<EmptyState title="Nothing yet" actionLabel="Clear filters" onAction={vi.fn()} />);
        const cta = screen.getByRole("button", { name: "Clear filters" });
        expect(cta.className).toContain(SECONDARY_CTA);
        expect(cta.className).not.toContain(PRIMARY_CTA);
    });

    it("still allows a page to ask for the loud one", () => {
        wrap(<EmptyState title="Nothing yet" actionLabel="Post" href="/post/new" actionTone="primary" />);
        expect(screen.getByRole("link", { name: "Post" }).className).toContain(PRIMARY_CTA);
    });

    /**
     * A failed load is not an empty one: there is exactly one thing worth doing,
     * so retry keeps the primary button. Pinned so "make the empty states quiet"
     * doesn't quietly take this with it.
     */
    it("keeps the error retry primary", () => {
        wrap(<ErrorState subject="the feed" onRetry={vi.fn()} />);
        const retry = screen.getByRole("button", { name: "Try again" });
        expect(retry.className).toContain(PRIMARY_CTA);
        expect(retry.className).not.toContain(SECONDARY_CTA);
    });
});
