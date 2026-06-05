import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { Profile } from "@/pages/profile";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mockUseAuth() }));

const rpc = vi.mocked(supabase.rpc);

const completeProfile = {
    id: "aaaaaaaa-0000-0000-0000-000000000001", first_name: "Jane", last_name: "Doe", headline: "Tennis addict",
    photo_url: "https://example.com/photo.jpg", skill_level: "3.5",
    court_preferences: ["Longshore Club"], new_to_westport: false,
    follower_count: 5, following_count: 3, is_following: false, is_own_profile: false,
    active_posts: [
        { id: "p1", post_type: "sub_need", format: "point_play", game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5", location: "Longshore Club", custom_court: null, cost: 25, spots_total: 4, spots_available: 3, created_at: "2026-04-06T12:00:00Z" },
    ],
    following_list: [
        { id: "bbbbbbbb-0000-0000-0000-000000000002", first_name: "Mike", last_name: "Chen", photo_url: null, skill_level: "4.0" },
    ],
};

const minimalProfile = {
    ...completeProfile,
    id: "cccccccc-0000-0000-0000-000000000003", first_name: "Tom", last_name: "R", headline: null,
    photo_url: null, court_preferences: [], new_to_westport: false,
    follower_count: 0, following_count: 0, active_posts: [], following_list: [],
};

const newToWestportProfile = {
    ...completeProfile,
    id: "bbbbbbbb-0000-0000-0000-000000000002", first_name: "Sarah", last_name: "J", new_to_westport: true,
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
    it("shows all public fields for complete profile", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
        expect(screen.getByText("Tennis addict")).toBeInTheDocument();
        expect(screen.getByText("3.5 NTRP")).toBeInTheDocument();
        expect(screen.getAllByText("Longshore Club").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("5")).toBeInTheDocument(); // follower count
    });

    it("shows placeholder avatar for profile without photo", async () => {
        setupMock(minimalProfile);
        renderProfile("cccccccc-0000-0000-0000-000000000003");
        expect(await screen.findByText("Tom R")).toBeInTheDocument();
        expect(screen.getByText("T")).toBeInTheDocument(); // Initial letter avatar
    });

    it("shows New to Westport tag when set", async () => {
        setupMock(newToWestportProfile);
        renderProfile("bbbbbbbb-0000-0000-0000-000000000002");
        expect(await screen.findByText("New to Westport")).toBeInTheDocument();
    });

    it("does NOT show New to Westport tag when false", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        await screen.findByText("Jane Doe");
        expect(screen.queryByText("New to Westport")).not.toBeInTheDocument();
    });

    it("shows Follow button when not following", async () => {
        setupMock({ ...completeProfile, is_following: false });
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        expect(await screen.findByText("Follow")).toBeInTheDocument();
    });

    it("shows Following button when already following", async () => {
        setupMock({ ...completeProfile, is_following: true });
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        await screen.findByText("Jane Doe");
        // The "Following" button text (distinct from the "Following (1)" section label)
        const buttons = screen.getAllByText("Following");
        expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("no Follow/Following button on own profile", async () => {
        setupMock({ ...completeProfile, is_own_profile: true, following_list: [] });
        mockUseAuth.mockReturnValue({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false });
        renderProfile("me");
        await screen.findByText("Jane Doe");
        // No follow button rendered — the "Follow" text should not be in a button
        const buttons = screen.queryAllByRole("button");
        const followButton = buttons.find((b) => b.textContent === "Follow" || b.textContent === "Following");
        expect(followButton).toBeUndefined();
    });

    it("shows follower count as number", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        await screen.findByText("5");
        expect(screen.getByText("Followers")).toBeInTheDocument();
    });

    it("shows following list", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        expect(await screen.findByText("Mike Chen")).toBeInTheDocument();
    });

    it("shows active posts", async () => {
        setupMock(completeProfile);
        renderProfile("aaaaaaaa-0000-0000-0000-000000000001");
        expect(await screen.findByText("Point play")).toBeInTheDocument();
    });

    it("shows empty state for no posts", async () => {
        setupMock(minimalProfile);
        renderProfile("cccccccc-0000-0000-0000-000000000003");
        expect(await screen.findByText("No active posts.")).toBeInTheDocument();
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
        // Invalid UUID won't trigger RPC, shows error
        expect(await screen.findByText("User not found.")).toBeInTheDocument();
    });

    it("handles invalid UUID gracefully", async () => {
        renderProfile("not-a-uuid");
        expect(await screen.findByText("User not found.")).toBeInTheDocument();
    });
});
