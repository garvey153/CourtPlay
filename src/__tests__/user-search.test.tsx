import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { Profile } from "@/pages/profile";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "aaaaaaaa-0000-0000-0000-000000000001" }, loading: false }),
}));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

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

const SEARCH_PLACEHOLDER = "Search for players to follow...";

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
    it("search by name returns matching users with skill descriptor", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "Mi");
        // "Mike Chen" + skill 4.0 -> "Mike C. · Intermediate+"
        await waitFor(() => {
            expect(screen.getByText("Mike C. · Intermediate+")).toBeInTheDocument();
        });
    });

    it("search result shows Follow action for unfollowed users", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "Mi");
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
        });
    });

    it("search result shows Following for already-followed users", async () => {
        setupMock();
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "Sa");
        const row = (await screen.findByText("Sarah J. · Intermediate")).closest("div")!;
        expect(within(row).getByText("Following")).toBeInTheDocument();
    });

    it("no results shows the empty message", async () => {
        setupMock([]);
        const user = userEvent.setup();
        renderProfile();
        await screen.findByText("Jane Doe");
        await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "Zz");
        await waitFor(() => {
            expect(screen.getByText("No players found.")).toBeInTheDocument();
        });
    });

    it("shows the following list when not searching", async () => {
        setupMock();
        renderProfile();
        await screen.findByText("Jane Doe");
        // Nothing typed → search results not shown
        expect(screen.queryByText("Mike C. · Intermediate+")).not.toBeInTheDocument();
    });
});
