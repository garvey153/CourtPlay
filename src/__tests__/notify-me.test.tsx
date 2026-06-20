import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { supabase } from "@/lib/supabase";
import type { FeedPost } from "@/types/feed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (ui: any) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
}));

const rpc = vi.mocked(supabase.rpc);

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1", author_id: "author-1", author_type: "player",
        post_type: "sub_need", format: "point_play", play_type: "doubles", duration: 2,
        total_players: 4, game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5",
        location: "Longshore Club", court_id: null, custom_court: null,
        pro_name: null, cost: 25, original_cost: null, spots_total: 2,
        series_id: null, notes: null, status: "active", view_count: 10,
        expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(), first_name: "Mike", last_name: "Chen",
        photo_url: null, is_friend: false, spots_available: 2,
        user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...overrides,
    };
}

const NOTIFY_LABEL = "Notify me if a spot opens";

beforeEach(() => { rpc.mockClear(); });

describe("notify me (claim-detail sheet)", () => {
    it("link shown when spots_available = 0 and no active claim", () => {
        render(<ClaimDetailSheet post={makePost({ spots_available: 0 })} currentUserId="other-user" onClose={vi.fn()} />);
        expect(screen.getByText(NOTIFY_LABEL)).toBeInTheDocument();
    });

    it("Claim button (not Notify) shown when spots are available", () => {
        render(<ClaimDetailSheet post={makePost({ spots_available: 2 })} currentUserId="other-user" onClose={vi.fn()} />);
        expect(screen.queryByText(NOTIFY_LABEL)).not.toBeInTheDocument();
        expect(screen.getByText(/Claim for/)).toBeInTheDocument();
    });

    it("calls add_notify_me RPC on click", async () => {
        const user = userEvent.setup();
        render(<ClaimDetailSheet post={makePost({ spots_available: 0 })} currentUserId="other-user" onClose={vi.fn()} />);
        await user.click(screen.getByText(NOTIFY_LABEL));
        expect(rpc).toHaveBeenCalledWith("add_notify_me", { p_post_id: "post-1" });
    });

    it("shows confirmation after click", async () => {
        const user = userEvent.setup();
        render(<ClaimDetailSheet post={makePost({ spots_available: 0 })} currentUserId="other-user" onClose={vi.fn()} />);
        await user.click(screen.getByText(NOTIFY_LABEL));
        expect(await screen.findByText(/We'll notify you/)).toBeInTheDocument();
    });

    it("already done shows confirmation text immediately", () => {
        render(<ClaimDetailSheet post={makePost({ spots_available: 0, user_notify_me: true })} currentUserId="other-user" onClose={vi.fn()} />);
        expect(screen.getByText(/We'll notify you/)).toBeInTheDocument();
        expect(screen.queryByText(NOTIFY_LABEL)).not.toBeInTheDocument();
    });

    it("not shown on own posts", () => {
        render(<ClaimDetailSheet post={makePost({ spots_available: 0 })} currentUserId="author-1" onClose={vi.fn()} />);
        expect(screen.queryByText(NOTIFY_LABEL)).not.toBeInTheDocument();
        expect(screen.getByText("This is your post.")).toBeInTheDocument();
    });
});
