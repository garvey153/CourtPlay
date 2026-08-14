import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { FeedPost } from "@/types/feed";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { supabase } from "@/lib/supabase";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc,
        from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
        functions: { invoke: vi.fn() },
    },
}));
vi.mock("@/lib/notifications", () => ({ sendNotification: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "user-b" }, loading: false }) }));
vi.mock("@/hooks/use-share", () => ({
    useShare: () => ({ shareData: null, handleShare: vi.fn(), closeShareModal: vi.fn() }),
}));
vi.mock("@/hooks/use-profile", () => ({
    useProfile: () => ({ profile: { id: "user-b", first_name: "Bea", skill_level: "5.0" } }),
}));

const post = (over: Partial<FeedPost> = {}): FeedPost =>
    ({
        id: "post-1", author_id: "author-1", author_type: "player", post_type: "sub_need",
        status: "active", format: "point_play", play_type: "doubles", duration: 2, total_players: 4,
        game_date: "2027-05-10", game_time: "09:00", skill_level: "3.0", location: "Longshore Club",
        court_id: "c1", custom_court: null, pro_name: null, cost: 25, original_cost: null,
        spots_total: 4, spots_available: 2, view_count: 0, notes: null, series_id: null,
        expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(), first_name: "Jane", last_name: "Doe", photo_url: null,
        is_friend: false, user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...over,
    }) as FeedPost;

/**
 * The "spot reopened" banner offers Undo, which opens this sheet so the spot can
 * be claimed again. Undo alone is not the task — closing the sheet without
 * claiming used to leave no way back, because the banner had already gone.
 *
 * The feed clears it on `onClaimed`, which fires only here. `onClaimChange` is
 * not usable for it: that also fires on cancel and on every reply, so the banner
 * would depend on the order two callbacks happen to run in.
 */
describe("ClaimDetailSheet — onClaimed", () => {
    beforeEach(() => {
        rpc.mockReset();
        vi.mocked(supabase.from).mockClear();
    });

    it("fires when a claim is submitted", async () => {
        rpc.mockResolvedValue({ data: { success: true, claim_id: "claim-9" }, error: null });
        const onClaimed = vi.fn();
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <ClaimDetailSheet post={post()} currentUserId="user-b" onClose={vi.fn()} onClaimed={onClaimed} />
            </MemoryRouter>,
        );
        await user.click(screen.getByRole("button", { name: "Claim for $25" }));

        await waitFor(() => expect(onClaimed).toHaveBeenCalled());
        expect(onClaimed.mock.calls[0][0].id).toBe("post-1");
    });

    it("does NOT fire when a claim is cancelled", async () => {
        rpc.mockResolvedValue({ data: { success: true, prior_status: "pending" }, error: null });
        const onClaimed = vi.fn();
        const onCancelled = vi.fn();
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <ClaimDetailSheet
                    post={post({ user_claim_status: "pending", user_claim_id: "claim-1" })}
                    currentUserId="user-b"
                    onClose={vi.fn()}
                    onClaimed={onClaimed}
                    onCancelled={onCancelled}
                />
            </MemoryRouter>,
        );
        await user.click(screen.getByRole("button", { name: "Cancel claim" }));

        await waitFor(() => expect(onCancelled).toHaveBeenCalled());
        expect(onClaimed).not.toHaveBeenCalled();
    });
});
