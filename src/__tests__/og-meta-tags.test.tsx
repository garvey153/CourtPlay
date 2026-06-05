import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { PostDetail } from "@/pages/post-detail";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn() },
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ profile: null, loading: false }) }));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const rpc = vi.mocked(supabase.rpc);

const activePost = {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    author_id: "author-1", author_type: "player", post_type: "sub_need",
    format: "point_play", total_players: 4, game_date: "2026-04-10", game_time: "09:00",
    skill_level: "3.5", location: "Longshore Club", court_id: null, custom_court: null,
    pro_name: null, cost: 25, original_cost: null, spots_total: 4, spots_available: 3,
    series_id: null, notes: null, status: "active", view_count: 10, expires_at: null,
    preferred_days: null, preferred_times: null, created_at: "2026-04-06T12:00:00Z",
    first_name: "Jane", last_name: "Doe", photo_url: null, is_friend: false,
    user_claim_status: null, user_claim_id: null, user_notify_me: false,
};

const expiredPost = { ...activePost, id: "cccccccc-0000-0000-0000-000000000003", status: "expired" };

function getMetaContent(property: string): string | null {
    const el = document.querySelector(`meta[property="${property}"]`);
    return el?.getAttribute("content") ?? null;
}

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
    // Clean meta tags
    document.querySelectorAll('meta[property^="og:"]').forEach((el) => el.remove());
});

afterEach(() => {
    document.querySelectorAll('meta[property^="og:"]').forEach((el) => el.remove());
});

describe("OG meta tags", () => {
    it("set for active sub_need post", async () => {
        rpc.mockResolvedValueOnce({ data: activePost, error: null } as never);
        renderWithRoute(activePost.id);
        await waitFor(() => {
            expect(getMetaContent("og:title")).toContain("Point play");
            expect(getMetaContent("og:description")).toContain("3.5 NTRP");
            expect(getMetaContent("og:description")).toContain("Longshore Club");
            expect(getMetaContent("og:type")).toBe("website");
        });
    });

    it("set for expired/deleted post with generic message", async () => {
        rpc.mockResolvedValueOnce({ data: expiredPost, error: null } as never);
        renderWithRoute(expiredPost.id);
        await waitFor(() => {
            expect(getMetaContent("og:description")).toContain("no longer available");
        });
    });

    it("set for non-existent post with generic message", async () => {
        rpc.mockResolvedValueOnce({ data: null, error: null } as never);
        renderWithRoute("dddddddd-0000-0000-0000-000000000004");
        await waitFor(() => {
            expect(getMetaContent("og:description")).toContain("no longer available");
        });
    });

    it("description does not contain unescaped HTML from notes", async () => {
        const postWithXss = { ...activePost, notes: '<script>alert("xss")</script>' };
        rpc.mockResolvedValueOnce({ data: postWithXss, error: null } as never);
        renderWithRoute(activePost.id);
        await waitFor(() => {
            const desc = getMetaContent("og:description");
            expect(desc).not.toContain("<script>");
        });
    });

    it("description does not contain PII beyond poster first name", async () => {
        const postWithPii = { ...activePost, first_name: "Jane" };
        rpc.mockResolvedValueOnce({ data: postWithPii, error: null } as never);
        renderWithRoute(activePost.id);
        await waitFor(() => {
            const desc = getMetaContent("og:description");
            // OG description should NOT contain phone, email, venmo, last name
            expect(desc).not.toContain("Doe");
            expect(desc).not.toContain("phone");
            expect(desc).not.toContain("venmo");
        });
    });
});
