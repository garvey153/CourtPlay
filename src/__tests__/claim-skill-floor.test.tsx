import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { FeedPost } from "@/types/feed";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
        functions: { invoke: vi.fn() },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "user-b" }, loading: false }) }));
vi.mock("@/hooks/use-share", () => ({
    useShare: () => ({ shareData: null, handleShare: vi.fn(), closeShareModal: vi.fn() }),
}));

const { viewerLevel } = vi.hoisted(() => ({ viewerLevel: { current: null as string | null } }));
vi.mock("@/hooks/use-profile", () => ({
    useProfile: () => ({ profile: { id: "user-b", first_name: "Bea", skill_level: viewerLevel.current } }),
}));

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1", author_id: "author-1", author_type: "player", post_type: "sub_need",
        status: "active", format: "point_play", total_players: 4,
        game_date: "2026-05-10", game_time: "09:00", skill_level: "4.0",
        location: "Longshore Club", court_id: "court-1", custom_court: null, pro_name: null,
        cost: 25, original_cost: null, spots_total: 4, spots_available: 2, view_count: 7,
        notes: null, series_id: null, expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Jane", last_name: "Doe", photo_url: null, is_friend: false,
        user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...overrides,
    } as FeedPost;
}

const open = (level: string | null, post: Partial<FeedPost> = {}) => {
    viewerLevel.current = level;
    return render(
        <MemoryRouter>
            <ClaimDetailSheet post={makePost(post)} currentUserId="user-b" onClose={vi.fn()} />
        </MemoryRouter>,
    );
};

/** The claim button carries the price, not the word "claim". */
const claimButton = () => screen.getByRole("button", { name: "Claim for $25" });
const notice = () => screen.queryByText(/sit this one out/);

/**
 * A 4.0 game: only 4.0 and above may claim it. The notice explains the disabled
 * button — the two must appear and disappear together, since either alone is a
 * bug: a disabled button with no reason, or a reason that doesn't bite.
 */
describe("claim floor — rated below the game", () => {
    beforeEach(() => vi.clearAllMocks());

    it("3.0 on a 4.0 game: notice shown, button disabled", () => {
        open("3.0");
        expect(notice()).toBeInTheDocument();
        expect(claimButton()).toBeDisabled();
    });

    it("names both ratings, so the message is actionable", () => {
        open("3.0");
        expect(screen.getByText(/This game is for NTRP 4.0 and up/)).toBeInTheDocument();
        expect(screen.getByText(/Your level is 3.0/)).toBeInTheDocument();
    });

    it("3.5 on a 4.0 game: half a step below is still blocked", () => {
        open("3.5");
        expect(notice()).toBeInTheDocument();
        expect(claimButton()).toBeDisabled();
    });

    it("same level claims", () => {
        open("4.0");
        expect(notice()).not.toBeInTheDocument();
        expect(claimButton()).toBeEnabled();
    });

    it("playing up is never restricted", () => {
        open("5.0");
        expect(notice()).not.toBeInTheDocument();
        expect(claimButton()).toBeEnabled();
    });

    it("no rating on file does not lock anyone out", () => {
        open(null);
        expect(notice()).not.toBeInTheDocument();
        expect(claimButton()).toBeEnabled();
    });

    it("a post with no level does not block either", () => {
        open("2.5", { skill_level: null });
        expect(notice()).not.toBeInTheDocument();
    });

    it("sits between the disclaimer and the button it disables", () => {
        open("3.0");
        const order = screen.getByRole("dialog").querySelectorAll("p, button");
        const seq = Array.from(order).map((el) => el.textContent ?? "");
        const disclaimer = seq.findIndex((t) => t.includes("sent to Jane for approval"));
        const message = seq.findIndex((t) => t.includes("sit this one out"));
        const button = seq.findIndex((t) => t === "Claim for $25");
        expect(disclaimer).toBeGreaterThanOrEqual(0);
        expect(message).toBeGreaterThan(disclaimer);
        expect(button).toBeGreaterThan(message);
    });

    it("uses the design system's error red at the disclaimer's size", () => {
        open("3.0");
        expect(notice()!.className).toContain("text-error-primary");
        expect(notice()!.className).toContain("text-xs");
    });

    // States with no claim button have nothing to explain.
    it("stays quiet on your own post", () => {
        open("3.0", { author_id: "user-b" });
        expect(notice()).not.toBeInTheDocument();
    });

    it("stays quiet on a full post", () => {
        open("3.0", { spots_available: 0 });
        expect(notice()).not.toBeInTheDocument();
    });

    it("stays quiet on an expired post", () => {
        open("3.0", { status: "expired" });
        expect(notice()).not.toBeInTheDocument();
    });

    it("stays quiet once you already have a claim", () => {
        open("3.0", { user_claim_status: "pending", user_claim_id: "claim-1" });
        expect(notice()).not.toBeInTheDocument();
    });
});
