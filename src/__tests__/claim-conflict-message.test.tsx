import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { FeedPost } from "@/types/feed";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
        functions: { invoke: vi.fn() },
        rpc,
    },
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "user-b" }, loading: false }) }));
vi.mock("@/hooks/use-share", () => ({
    useShare: () => ({ shareData: null, handleShare: vi.fn(), closeShareModal: vi.fn() }),
}));
vi.mock("@/hooks/use-profile", () => ({
    useProfile: () => ({ profile: { id: "user-b", first_name: "Bea", skill_level: "4.0" } }),
}));

function makePost(): FeedPost {
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
    } as FeedPost;
}

const CONFLICT = {
    data: { success: false, conflict: true, conflict_date: "2026-05-10", conflict_time: "09:00:00" },
    error: null,
};

const MESSAGE = "You have another claim at this time.";

const open = () =>
    render(
        <MemoryRouter>
            <ClaimDetailSheet post={makePost()} currentUserId="user-b" onClose={vi.fn()} />
        </MemoryRouter>,
    );

const claimButton = () => screen.getByRole("button", { name: "Claim for $25" });

/**
 * Claiming a game that overlaps one you already hold (Figma 671:4389).
 *
 * The message sits above the title rather than in a block beside the button,
 * so it is the first thing read when the sheet re-renders.
 */
describe("claim conflict message", () => {
    beforeEach(() => {
        rpc.mockReset();
        rpc.mockResolvedValue(CONFLICT);
    });

    it("says nothing until the claim is actually refused", () => {
        open();
        expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    });

    it("shows the message and disables the button when the claim conflicts", async () => {
        open();
        fireEvent.click(claimButton());
        await waitFor(() => expect(screen.getByText(MESSAGE)).toBeInTheDocument());
        expect(claimButton()).toBeDisabled();
    });

    it("puts the message above the game title, not below it", async () => {
        const { container } = open();
        fireEvent.click(claimButton());
        const message = await screen.findByText(MESSAGE);
        const title = container.querySelector("#claim-sheet-title")!;
        // DOCUMENT_POSITION_FOLLOWING: the title comes after the message.
        expect(message.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    /**
     * red-400 (#f97066), which is what text-error-primary resolves to in the
     * dark theme. Deliberately NOT text-utility-red-400 — the dark theme remaps
     * that one to red-600, so the obvious-looking class gives a darker red.
     */
    it("renders the message in the error colour", async () => {
        open();
        fireEvent.click(claimButton());
        const message = await screen.findByText(MESSAGE);
        expect(message.className).toContain("text-error-primary");
        expect(message.className).not.toContain("utility-red");
    });

    /**
     * Sized to the line it sits above, not to the Figma frame's 12px — the
     * subtitle is 14px in the build, and an error smaller than the text under
     * it reads as fine print. Pinned as a pair so neither can drift alone.
     */
    it("is the same size as the location line", async () => {
        const { container } = open();
        fireEvent.click(claimButton());
        const message = await screen.findByText(MESSAGE);
        const subtitle = container.querySelector("#claim-sheet-title")!.nextElementSibling!;
        expect(subtitle.textContent).toMatch(/Longshore Club/);
        expect(message.className).toContain("text-sm");
        expect(subtitle.className).toContain("text-sm");
    });

    /**
     * A generic failure is not a conflict: it must not borrow the conflict's
     * wording, or an unrelated outage would tell people to go cancel a claim
     * they do not have.
     */
    it("leaves other failures to the generic error line", async () => {
        rpc.mockResolvedValue({ data: { success: false, error: "Spot already taken." }, error: null });
        open();
        fireEvent.click(claimButton());
        expect(await screen.findByText("Spot already taken.")).toBeInTheDocument();
        expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    });
});
