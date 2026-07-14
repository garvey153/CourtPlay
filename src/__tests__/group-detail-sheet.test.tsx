import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupDetailSheet } from "@/components/app/group-detail-sheet";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import type { FeedPost } from "@/types/feed";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/lib/notifications", () => ({ sendNotification: vi.fn() }));
vi.mock("@/hooks/use-share", () => ({
    useShare: () => ({ shareData: null, handleShare: vi.fn(), closeShareModal: vi.fn() }),
}));

const rpc = vi.mocked(supabase.rpc);
const notify = vi.mocked(sendNotification);

const regularPost: FeedPost = {
    id: "post-r1",
    author_id: "seeker-1",
    author_type: "player",
    post_type: "regular_game",
    format: null,
    play_type: null,
    duration: null,
    total_players: null,
    game_date: null,
    game_time: null,
    skill_level: "4.0",
    location: "Longshore Club",
    court_id: null,
    custom_court: null,
    pro_name: null,
    cost: null,
    original_cost: null,
    spots_total: 1,
    series_id: null,
    notes: "Looking to join a regular doubles group.",
    status: "active",
    view_count: 0,
    expires_at: null,
    preferred_days: ["Mon", "Wed"],
    preferred_times: ["Morning"],
    created_at: new Date().toISOString(),
    first_name: "Sam",
    last_name: "Seeker",
    photo_url: null,
    is_friend: false,
    spots_available: 0,
    user_claim_status: null,
    user_claim_id: null,
    user_notify_me: false,
};

describe("GroupDetailSheet (regular-post connections)", () => {
    beforeEach(() => {
        rpc.mockReset();
        notify.mockReset();
    });

    it("Connect starts a conversation via 2-arg submit_claim and notifies the seeker", async () => {
        // Two-arg call resolves the overloaded RPC (guards against the PGRST203 the
        // one-arg call used to hit).
        rpc.mockResolvedValue({ data: { success: true, claim_id: "conn-1" }, error: null } as never);
        const user = userEvent.setup();

        render(<GroupDetailSheet post={regularPost} currentUserId="responder-1" onClose={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Connect" }));

        await waitFor(() => expect(rpc).toHaveBeenCalledWith("submit_claim", { p_post_id: "post-r1", p_message: null }));
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ notification_type: "connection_request", user_id: "seeker-1" }));
        // Transitions in place to the connected thread state, which reveals the message field.
        expect(await screen.findByText(/You're connected/)).toBeInTheDocument();
        expect(screen.getByLabelText("Message")).toBeInTheDocument();
    });

    it("shows no message field before connecting", () => {
        render(<GroupDetailSheet post={regularPost} currentUserId="responder-1" onClose={vi.fn()} />);
        expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    });

    it("cancels the connection via unclaim when connected", async () => {
        rpc.mockResolvedValue({ error: null } as never);
        const onCancelled = vi.fn();
        const user = userEvent.setup();
        const connected = { ...regularPost, user_claim_status: "pending" as const, user_claim_id: "conn-9" };

        render(
            <GroupDetailSheet post={connected} currentUserId="responder-1" onClose={vi.fn()} onCancelled={onCancelled} />,
        );

        await user.click(screen.getByRole("button", { name: "Cancel connection" }));
        await waitFor(() => expect(rpc).toHaveBeenCalledWith("unclaim", { p_claim_id: "conn-9" }));
        expect(onCancelled).toHaveBeenCalled();
    });

    it("shows a read-only closed thread once the seeker removed the post", () => {
        const closed = { ...regularPost, status: "deleted", user_claim_status: "pending" as const, user_claim_id: "conn-3" };
        render(
            <GroupDetailSheet
                post={closed}
                currentUserId="responder-1"
                onClose={vi.fn()}
                messages={[
                    {
                        id: "m1",
                        sender_id: "responder-1",
                        body: "We have a spot!",
                        created_at: new Date().toISOString(),
                        first_name: "Re",
                        last_name: "Sponder",
                        photo_url: null,
                    },
                ]}
            />,
        );

        expect(screen.getByText(/found a spot/)).toBeInTheDocument();
        expect(screen.getByText(/We have a spot!/)).toBeInTheDocument();
        // Closed thread is read-only — no Connect button and no message field.
        expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    });
});
