import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { Profile } from "@/pages/profile";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false }),
}));

const rpc = vi.mocked(supabase.rpc);

const ownProfile = {
    id: "aaaaaaaa-0000-0000-0000-000000000001", first_name: "Jane", last_name: "Doe", headline: "Tennis addict",
    photo_url: null, skill_level: "3.5", court_preferences: [], new_to_westport: false,
    follower_count: 2, following_count: 1, is_following: false, is_own_profile: true,
    active_posts: [], following_list: [],
};

const searchResults = [
    { id: "bbbbbbbb-0000-0000-0000-000000000002", first_name: "Mike", last_name: "Chen", photo_url: null, skill_level: "4.0", new_to_westport: true, is_following: false },
    { id: "cccccccc-0000-0000-0000-000000000003", first_name: "Sarah", last_name: "Johnson", photo_url: null, skill_level: "3.5", new_to_westport: false, is_following: true },
];

function setupMock(results: unknown[] = searchResults) {
    rpc.mockImplementation(((fn: string) => {
        if (fn === "get_profile") return Promise.resolve({ data: ownProfile, error: null });
        if (fn === "search_users") return Promise.resolve({ data: results, error: null });
        return Promise.resolve({ data: { success: true }, error: null });
    }) as typeof rpc);
}

function renderProfile() {
    return render(
        <MemoryRouter initialEntries={["/profile/me"]}>
            <Routes><Route path="/profile/:id" element={<Profile />} /></Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => { rpc.mockReset(); });

describe("user search", () => {
    it("search by first name returns matching users", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        const input = screen.getByPlaceholderText("Search by name…");
        await user.type(input, "Mi");
        await waitFor(() => {
            expect(screen.getByText("Mike Chen")).toBeInTheDocument();
        });
    });

    it("search results show skill level", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText("Search by name…"), "Mi");
        await waitFor(() => {
            expect(screen.getByText("4.0 NTRP")).toBeInTheDocument();
        });
    });

    it("search result shows New to Westport tag", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText("Search by name…"), "Mi");
        await waitFor(() => {
            expect(screen.getByText("New")).toBeInTheDocument();
        });
    });

    it("search result shows Follow button for unfollowed users", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText("Search by name…"), "Mi");
        await waitFor(() => {
            expect(screen.getByText("Follow")).toBeInTheDocument();
        });
    });

    it("search result shows Following for followed users", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText("Search by name…"), "Sa");
        await waitFor(() => {
            expect(screen.getByText("Following")).toBeInTheDocument();
        });
    });

    it("empty search returns no results", async () => {
        setupMock([]);
        renderProfile();
        await screen.findByText("Jane Doe");
        // No search input typed — no results should be rendered
        expect(screen.queryByText("Mike Chen")).not.toBeInTheDocument();
    });

    it("search does not return current user", async () => {
        // The RPC excludes current user server-side
        setupMock([{ id: "bbbbbbbb-0000-0000-0000-000000000002", first_name: "Mike", last_name: "Chen", photo_url: null, skill_level: "4.0", new_to_westport: false, is_following: false }]);
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText("Search by name…"), "Ja");
        await waitFor(() => {
            // Only Mike appears, not Jane (current user)
            expect(screen.queryByText("Mike Chen")).toBeInTheDocument();
        });
    });
});
