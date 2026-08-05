import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { BottomNav } from "@/components/layout/bottom-nav";

/**
 * Covers the tab set, the ordering, and the active rule — including the one
 * non-obvious case: another player's profile must NOT light up the Profile tab,
 * only your own.
 *
 * Active state is asserted via aria-current rather than the Tailwind classes that
 * also express it — the attribute is the stable contract and survives a palette
 * change.
 */

vi.mock("@/hooks/use-auth");
vi.mock("@/hooks/use-profile");

const mockUseAuth = vi.mocked(useAuth);
const mockUseProfile = vi.mocked(useProfile);

const USER_ID = "user-1";

function mockUser(isAdmin = false) {
    mockUseAuth.mockReturnValue({ user: { id: USER_ID } } as ReturnType<typeof useAuth>);
    mockUseProfile.mockReturnValue({ profile: { is_admin: isAdmin } } as ReturnType<typeof useProfile>);
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <BottomNav />
        </MemoryRouter>,
    );
}

function isActive(label: string): boolean {
    return screen.getByRole("link", { name: label }).getAttribute("aria-current") === "page";
}

beforeEach(() => {
    vi.clearAllMocks();
    mockUser();
});

describe("BottomNav", () => {
    it("renders the three base tabs in the designed order", () => {
        renderAt("/feed");
        const labels = screen.getAllByRole("link").map((a) => a.textContent);
        expect(labels).toEqual(["Feed", "Activity", "Profile"]);
    });

    it("marks only the current tab active", () => {
        renderAt("/activity");
        expect(isActive("Activity")).toBe(true);
        expect(isActive("Feed")).toBe(false);
        expect(isActive("Profile")).toBe(false);
    });

    it("marks Profile active on your own profile", () => {
        renderAt("/profile/me");
        expect(isActive("Profile")).toBe(true);
        expect(isActive("Feed")).toBe(false);
    });

    it("does NOT mark Profile active on another player's profile", () => {
        renderAt("/profile/someone-else");
        expect(isActive("Profile")).toBe(false);
    });

    it("marks Profile active on your own profile by id", () => {
        renderAt(`/profile/${USER_ID}`);
        expect(isActive("Profile")).toBe(true);
    });

    it("hides Admin from non-admins and shows it to admins as a fourth tab", () => {
        const { unmount } = renderAt("/feed");
        expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
        unmount();

        mockUser(true);
        renderAt("/admin");
        const labels = screen.getAllByRole("link").map((a) => a.textContent);
        expect(labels).toEqual(["Feed", "Activity", "Profile", "Admin"]);
        expect(isActive("Admin")).toBe(true);
    });
});
