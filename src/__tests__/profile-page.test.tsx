import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { Profile } from "@/pages/profile";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mockUseAuth() }));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const rpc = vi.mocked(supabase.rpc);

const completeProfile = {
    id: "aaaaaaaa-0000-0000-0000-000000000001", first_name: "Jane", last_name: "Doe", headline: "Tennis addict",
    photo_url: "https://example.com/photo.jpg", skill_level: "3.5",
    court_preferences: ["Longshore Club"], new_to_westport: false,
    follower_count: 5, following_count: 3, is_following: false, is_own_profile: false,
    active_posts: [
        { id: "p1", post_type: "sub_need", format: "point_play", play_type: "doubles", duration: 2, notes: null, status: "active", game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5", location: "Longshore Club", custom_court: null, cost: 25, spots_total: 4, spots_available: 3, created_at: "2026-04-06T12:00:00Z" },
    ],
    following_list: [
        { id: "bbbbbbbb-0000-0000-0000-000000000002", first_name: "Mike", last_name: "Chen", photo_url: null, skill_level: "4.0" },
    ],
};

const minimalProfile = {
    ...completeProfile,
    id: "cccccccc-0000-0000-0000-000000000003", first_name: "Tom", last_name: "R", headline: null,
    photo_url: null, skill_level: null, court_preferences: [], new_to_westport: false,
    follower_count: 0, following_count: 0, active_posts: [], following_list: [],
};

function setupMock(profileData: unknown) {
    rpc.mockImplementation(((fn: string) => {
        if (fn === "get_profile") return Promise.resolve({ data: profileData, error: null });
        return Promise.resolve({ data: { success: true }, error: null });
    }) as typeof rpc);
}

function renderProfile(userId: string) {
    return render(
        <MemoryRouter initialEntries={[`/profile/${userId}`]}>
            <Routes><Route path="/profile/:id" element={<Profile />} /></Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    rpc.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: "dddddddd-0000-0000-0000-000000000004" }, loading: false });
});

describe("profile page", () => {
    it("shows name, skill descriptor, and stats for complete profile", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
        // skill_level 3.5 -> "Intermediate" descriptor
        expect(screen.getByText("Intermediate")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument(); // follower count
        expect(screen.getByText("Followers")).toBeInTheDocument();
        expect(screen.getByText("Following")).toBeInTheDocument();
    });

    it("shows placeholder avatar for profile without photo", async () => {
        setupMock(minimalProfile);
        renderProfile("cccccccc-0000-0000-0000-000000000003");
        expect(await screen.findByText("Tom R")).toBeInTheDocument();
        expect(screen.getByText("T")).toBeInTheDocument(); // Initial letter avatar
    });

    it("shows Follow button when not following", async () => {
        setupMock({ ...completeProfile, is_following: false });
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
    });

    it("shows Following button when already following", async () => {
        setupMock({ ...completeProfile, is_following: true });
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        await screen.findByText("Jane Doe");
        expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
    });

    it("no Follow/Following CTA on own profile", async () => {
        setupMock({ ...completeProfile, is_own_profile: true, following_list: [] });
        mockUseAuth.mockReturnValue({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false });
        renderProfile("me");
        await screen.findByText("Jane Doe");
        const buttons = screen.queryAllByRole("button");
        const followButton = buttons.find((b) => b.textContent === "Follow" || b.textContent === "Following");
        expect(followButton).toBeUndefined();
    });

    it("shows Edit profile link on own profile", async () => {
        setupMock({ ...completeProfile, is_own_profile: true });
        mockUseAuth.mockReturnValue({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false });
        renderProfile("me");
        expect(await screen.findByText("Edit profile")).toBeInTheDocument();
    });

    it("does NOT show Edit profile on another user's profile", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        await screen.findByText("Jane Doe");
        expect(screen.queryByText("Edit profile")).not.toBeInTheDocument();
    });

    it("shows following list with name + skill descriptor (own profile)", async () => {
        setupMock({ ...completeProfile, is_own_profile: true });
        mockUseAuth.mockReturnValue({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false });
        renderProfile("me");
        // "Mike Chen" -> "Mike C. · Intermediate+"
        expect(await screen.findByText("Mike C. · Intermediate+")).toBeInTheDocument();
    });

    it("shows the follow search only on own profile", async () => {
        setupMock({ ...completeProfile, is_own_profile: true });
        mockUseAuth.mockReturnValue({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false });
        renderProfile("me");
        expect(await screen.findByPlaceholderText("Search for players to follow...")).toBeInTheDocument();
    });

    it("does NOT show follow search on another user's profile", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        await screen.findByText("Jane Doe");
        expect(screen.queryByPlaceholderText("Search for players to follow...")).not.toBeInTheDocument();
    });

    it("shows open posts as feed cards", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        // SubCard title: "Doubles Tennis · <when>"
        expect(await screen.findByText(/Doubles Tennis/)).toBeInTheDocument();
        expect(screen.getByText("Open posts (1)")).toBeInTheDocument();
    });

    it("shows empty state for no posts", async () => {
        setupMock(minimalProfile);
        renderProfile("cccccccc-0000-0000-0000-000000000003");
        expect(await screen.findByText("No open posts.")).toBeInTheDocument();
    });

    it("shows report menu on other profiles", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        await screen.findByText("Jane Doe");
        expect(screen.getByLabelText("More options")).toBeInTheDocument();
    });

    it("no report menu on own profile", async () => {
        setupMock({ ...completeProfile, is_own_profile: true });
        mockUseAuth.mockReturnValue({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false });
        renderProfile("me");
        await screen.findByText("Jane Doe");
        expect(screen.queryByLabelText("More options")).not.toBeInTheDocument();
    });

    it("shows User not found for null profile data", async () => {
        rpc.mockResolvedValueOnce({ data: null, error: null } as never);
        renderProfile("nonexistent-id");
        expect(await screen.findByText("User not found.")).toBeInTheDocument();
    });

    it("handles invalid UUID gracefully", async () => {
        renderProfile("not-a-uuid");
        expect(await screen.findByText("User not found.")).toBeInTheDocument();
    });
});
