import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("@/components/app/install-app-button", () => ({ InstallAppButton: () => null }));

/**
 * The beta must be reversible by one variable, so these assert both states of
 * the same page — and, just as importantly, that everything else is identical
 * between them. If the beta ever deleted a section, ending it would mean
 * restoring a page from git rather than flipping a switch.
 */
const renderLanding = async (inviteOnly: boolean) => {
    vi.resetModules();
    vi.stubEnv("VITE_INVITE_ONLY", inviteOnly ? "true" : "");
    const { Landing } = await import("@/pages/landing");
    return render(
        <MemoryRouter>
            <Landing />
        </MemoryRouter>,
    );
};

describe("landing page — closed beta", () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.unstubAllEnvs());

    it("advertises Sign up when open", async () => {
        await renderLanding(false);
        expect(screen.getAllByRole("link", { name: /Get started/ })[0]).toHaveAttribute("href", "/signup");
        expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
        expect(screen.queryByText(/Invite only while we're in beta/)).not.toBeInTheDocument();
    });

    it("advertises Sign in during the beta, and says why", async () => {
        await renderLanding(true);
        for (const link of screen.getAllByRole("link", { name: "Sign in" })) {
            expect(link).toHaveAttribute("href", "/signin");
        }
        expect(screen.getByText(/Invite only while we're in beta/)).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Get started/ })).not.toBeInTheDocument();
    });

    it("keeps every section in both states — the beta adds one line, removes nothing", async () => {
        const open = await renderLanding(false);
        const openHeadings = [...open.container.querySelectorAll("h1,h2,h3")].map((h) => h.textContent);
        open.unmount();

        const beta = await renderLanding(true);
        const betaHeadings = [...beta.container.querySelectorAll("h1,h2,h3")].map((h) => h.textContent);

        // The h1 is a rotating pun, so compare the stable section headings.
        expect(betaHeadings.slice(1)).toEqual(openHeadings.slice(1));
        expect(screen.getByText("How CourtPlay works:")).toBeInTheDocument();
        expect(screen.getAllByText(/Longshore Club/).length).toBeGreaterThan(0);
    });
});
