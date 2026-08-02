import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Groups } from "@/pages/groups";

/**
 * Smoke test for a brand-new route. The page itself is a shell, but it renders
 * inside AppLayout — which pulls in TopNav and BottomNav and therefore the auth
 * and profile hooks — so this catches the route crashing on mount, which is the
 * only way it can realistically fail today.
 */

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me-1" }, loading: false }) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ profile: { id: "me-1", is_admin: false }, loading: false }) }));

describe("Groups page", () => {
    it("renders the coming-soon empty state inside the app shell", () => {
        render(
            <MemoryRouter initialEntries={["/groups"]}>
                <Groups />
            </MemoryRouter>,
        );
        expect(screen.getByText(/Groups are still warming up/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Browse the feed/i })).toHaveAttribute("href", "/feed");
    });

    it("keeps the bottom nav, with Groups marked current", () => {
        render(
            <MemoryRouter initialEntries={["/groups"]}>
                <Groups />
            </MemoryRouter>,
        );
        expect(screen.getByRole("link", { name: "Groups" })).toHaveAttribute("aria-current", "page");
    });
});
