import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { ProtectedRoute } from "./protected-route";

vi.mock("@/hooks/use-auth");
vi.mock("@/hooks/use-profile");
vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
                }),
            }),
        }),
    },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseProfile = vi.mocked(useProfile);

const MOCK_USER = { id: "user-1", email: "test@example.com" } as ReturnType<typeof useAuth>["user"];

const MOCK_PROFILE = {
    id: "user-1",
    email: "test@example.com",
    first_name: "John",
    last_name: "Doe",
    headline: null,
    photo_url: null,
    skill_level: null,
    court_preferences: null,
    pro_preference: null,
    new_to_westport: false,
    is_admin: false,
    onesignal_player_id: null,
};

function renderProtected(initialPath: string, adminOnly = false) {
    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route
                    path={initialPath}
                    element={
                        <ProtectedRoute adminOnly={adminOnly}>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    }
                />
                <Route path="/signin" element={<div>Sign In Page</div>} />
                <Route path="/onboarding" element={<div>Onboarding Page</div>} />
                <Route path="/feed" element={<div>Feed Page</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("ProtectedRoute", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects unauthenticated user visiting /feed to /signin", () => {
        mockUseAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: null, loading: false, setProfile: vi.fn(), refreshProfile: vi.fn() });

        renderProtected("/feed");

        expect(screen.getByText("Sign In Page")).toBeInTheDocument();
        expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("redirects authenticated user without a profile to /onboarding", () => {
        mockUseAuth.mockReturnValue({ user: MOCK_USER, session: null, loading: false, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: null, loading: false, setProfile: vi.fn(), refreshProfile: vi.fn() });

        renderProtected("/feed");

        expect(screen.getByText("Onboarding Page")).toBeInTheDocument();
        expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("allows authenticated user with a profile to access /feed", () => {
        mockUseAuth.mockReturnValue({ user: MOCK_USER, session: null, loading: false, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: MOCK_PROFILE, loading: false, setProfile: vi.fn(), refreshProfile: vi.fn() });

        renderProtected("/feed");

        expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("redirects non-admin user visiting /admin to /feed", async () => {
        mockUseAuth.mockReturnValue({ user: MOCK_USER, session: null, loading: false, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: MOCK_PROFILE, loading: false, setProfile: vi.fn(), refreshProfile: vi.fn() });

        renderProtected("/admin", true);

        // Fresh admin check is async — wait for redirect
        await waitFor(() => {
            expect(screen.getByText("Feed Page")).toBeInTheDocument();
        });
        expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
});
