import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { PostDetail } from "@/pages/post-detail";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn(), from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() })) },
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mockUseAuth() }));

const mockUseProfile = vi.fn();
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => mockUseProfile() }));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const rpc = vi.mocked(supabase.rpc);

// A future game date so the post reads as open (not expired). SubCard blocks taps
// on expired cards, so a past date would prevent the claim sheet from opening.
const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const activeSubNeed = {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    author_id: "author-1", author_type: "player", post_type: "sub_need",
    format: "point_play", play_type: "point_play", duration: 2, total_players: 4, game_date: futureDate, game_time: "09:00",
    skill_level: "3.5", location: "Longshore Club", court_id: null, custom_court: null,
    pro_name: null, cost: 25, original_cost: null, spots_total: 4, spots_available: 3,
    series_id: null, notes: null, status: "active", view_count: 10, expires_at: null,
    preferred_days: null, preferred_times: null, created_at: "2026-04-06T12:00:00Z",
    first_name: "Jane", last_name: "Doe", photo_url: null, is_friend: false,
    user_claim_status: null, user_claim_id: null, user_notify_me: false,
};

const regularGame = { ...activeSubNeed, id: "bbbbbbbb-0000-0000-0000-000000000002", post_type: "regular_game", game_date: null, game_time: null, cost: null, preferred_days: ["Monday"], preferred_times: ["Morning"] };
const expiredPost = { ...activeSubNeed, id: "cccccccc-0000-0000-0000-000000000003", status: "expired" };
const fullPost = { ...activeSubNeed, id: "eeeeeeee-0000-0000-0000-000000000005", spots_available: 0 };

function renderWithRoute(postId: string) {
    return render(
        <MemoryRouter initialEntries={[`/post/${postId}`]}>
            <Routes>
                <Route path="/post/:id" element={<PostDetail />} />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    rpc.mockReset();
    mockUseAuth.mockReturnValue({ user: null, loading: false, session: null, signOut: vi.fn() });
    mockUseProfile.mockReturnValue({ profile: null, loading: false });
});

describe("PostDetail", () => {
    it("renders full SubCard for authenticated user viewing active sub_need", async () => {
        mockUseAuth.mockReturnValue({ user: { id: "user-b" }, loading: false, session: {}, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: { skill_level: "3.5", headline: "test" }, loading: false });
        rpc.mockResolvedValueOnce({ data: activeSubNeed, error: null } as never);
        renderWithRoute(activeSubNeed.id);
        expect(await screen.findByText(/Tennis/)).toBeInTheDocument();
        expect(screen.getByText(/Longshore Club/)).toBeInTheDocument();
        expect(screen.getByText(/NTRP 3\.5/)).toBeInTheDocument();
    });

    it("renders GroupCard for authenticated user viewing regular_game", async () => {
        mockUseAuth.mockReturnValue({ user: { id: "user-b" }, loading: false, session: {}, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: { skill_level: "3.5" }, loading: false });
        rpc.mockResolvedValueOnce({ data: regularGame, error: null } as never);
        renderWithRoute(regularGame.id);
        expect(await screen.findByText(/Tennis, Regular Play/)).toBeInTheDocument();
    });

    it("renders preview for unauthenticated user viewing active sub_need", async () => {
        rpc.mockResolvedValueOnce({ data: activeSubNeed, error: null } as never);
        renderWithRoute(activeSubNeed.id);
        expect(await screen.findByText("Point Play")).toBeInTheDocument();
        expect(screen.getByText("Sign in to claim this spot")).toBeInTheDocument();
        // Poster name should not be visible in preview
        expect(screen.queryByText("Jane")).not.toBeInTheDocument();
    });

    it("unauthenticated CTA links to signup with redirect", async () => {
        rpc.mockResolvedValueOnce({ data: activeSubNeed, error: null } as never);
        renderWithRoute(activeSubNeed.id);
        const cta = await screen.findByText("Sign in to claim this spot");
        const link = cta.closest("a");
        expect(link?.getAttribute("href")).toContain("/signup?redirect=");
        expect(link?.getAttribute("href")).toContain(activeSubNeed.id);
    });

    it("renders expired state for expired post — authenticated", async () => {
        mockUseAuth.mockReturnValue({ user: { id: "user-b" }, loading: false, session: {}, signOut: vi.fn() });
        rpc.mockResolvedValueOnce({ data: expiredPost, error: null } as never);
        renderWithRoute(expiredPost.id);
        expect(await screen.findByText("This spot is no longer available.")).toBeInTheDocument();
        expect(screen.getByText(/Browse open spots/)).toBeInTheDocument();
    });

    it("renders expired state for expired post — unauthenticated", async () => {
        rpc.mockResolvedValueOnce({ data: expiredPost, error: null } as never);
        renderWithRoute(expiredPost.id);
        expect(await screen.findByText("This spot is no longer available.")).toBeInTheDocument();
        expect(screen.getByText(/Sign up to find a sub/)).toBeInTheDocument();
    });

    it("renders 404 for non-existent post ID", async () => {
        rpc.mockResolvedValueOnce({ data: null, error: null } as never);
        renderWithRoute("dddddddd-0000-0000-0000-000000000004");
        expect(await screen.findByText("This spot is no longer available.")).toBeInTheDocument();
    });

    it("handles invalid UUID in route param", async () => {
        renderWithRoute("not-a-uuid");
        expect(await screen.findByText("This spot is no longer available.")).toBeInTheDocument();
        expect(rpc).not.toHaveBeenCalled();
    });

    it("shows loading state while fetching", () => {
        rpc.mockReturnValue(new Promise(() => {}) as never); // never resolves
        renderWithRoute(activeSubNeed.id);
        expect(document.querySelector(".animate-spin")).toBeTruthy();
    });

    it("shows error state on fetch failure", async () => {
        rpc.mockRejectedValueOnce(new Error("Network error") as never);
        renderWithRoute(activeSubNeed.id);
        expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("opens claim sheet with Claim button when the post has spots", async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue({ user: { id: "user-b" }, loading: false, session: {}, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: { skill_level: "3.5" }, loading: false });
        rpc.mockResolvedValueOnce({ data: activeSubNeed, error: null } as never);
        renderWithRoute(activeSubNeed.id);
        const card = await screen.findByText(/Tennis/);
        await user.click(card.closest("button")!);
        expect(await screen.findByText(/Claim for/)).toBeInTheDocument();
    });

    it("opens claim sheet with Notify Me on a full post", async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue({ user: { id: "user-b" }, loading: false, session: {}, signOut: vi.fn() });
        mockUseProfile.mockReturnValue({ profile: { skill_level: "3.5" }, loading: false });
        rpc.mockResolvedValueOnce({ data: fullPost, error: null } as never);
        renderWithRoute(fullPost.id);
        const card = await screen.findByText(/Tennis/);
        await user.click(card.closest("button")!);
        expect(await screen.findByText("Notify me if a spot opens")).toBeInTheDocument();
    });
});
