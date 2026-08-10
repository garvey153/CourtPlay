import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegularPlaySheet } from "@/components/app/regular-play-sheet";
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

describe("RegularPlaySheet (regular-post connections)", () => {
    beforeEach(() => {
        rpc.mockReset();
        notify.mockReset();
    });

    it("Connect starts a conversation via 2-arg submit_claim and notifies the seeker", async () => {
        // Two-arg call resolves the overloaded RPC (guards against the PGRST203 the
        // one-arg call used to hit).
        rpc.mockResolvedValue({ data: { success: true, claim_id: "conn-1" }, error: null } as never);
        const user = userEvent.setup();

        render(<RegularPlaySheet post={regularPost} currentUserId="responder-1" onClose={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Connect" }));

        await waitFor(() => expect(rpc).toHaveBeenCalledWith("submit_claim", { p_post_id: "post-r1", p_message: null }));
        // The seeker is no longer named by the client — the server derives the
        // recipient from the claim, so the claim id is what has to be right here.
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ notification_type: "connection_request", claim_id: "conn-1" }));
        // Transitions in place to the connected thread state, which reveals the message field.
        expect(await screen.findByText(/You're connected/)).toBeInTheDocument();
        expect(screen.getByLabelText("Message")).toBeInTheDocument();
    });

    it("placeholder stays 'Message {name}…' until the poster replies", () => {
        const connected = { ...regularPost, user_claim_status: "pending" as const, user_claim_id: "c1" };
        const mine = {
            id: "m1",
            sender_id: "responder-1",
            body: "hi",
            created_at: new Date().toISOString(),
            first_name: "Re",
            last_name: "",
            photo_url: null,
        };
        const { rerender } = render(
            <RegularPlaySheet post={connected} currentUserId="responder-1" onClose={vi.fn()} messages={[mine]} />,
        );
        // Only my own message so far → still "Message Sam…".
        expect(screen.getByPlaceholderText("Message Sam…")).toBeInTheDocument();

        // The poster (author) replies → "Reply to Sam…".
        const fromPoster = { ...mine, id: "m2", sender_id: "seeker-1", body: "hey!" };
        rerender(
            <RegularPlaySheet post={connected} currentUserId="responder-1" onClose={vi.fn()} messages={[mine, fromPoster]} />,
        );
        expect(screen.getByPlaceholderText("Reply to Sam…")).toBeInTheDocument();
    });

    it("shows no message field before connecting", () => {
        render(<RegularPlaySheet post={regularPost} currentUserId="responder-1" onClose={vi.fn()} />);
        expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    });

    it("confirms before cancelling, then unclaims the connection and tells the seeker", async () => {
        // unclaim reports {success, prior_status}; the mock returned neither, so
        // it passed only because the handler wasn't checking.
        rpc.mockResolvedValue({ data: { success: true, prior_status: "pending" }, error: null } as never);
        const onCancelled = vi.fn();
        const user = userEvent.setup();
        const connected = { ...regularPost, user_claim_status: "pending" as const, user_claim_id: "conn-9" };

        render(
            <RegularPlaySheet post={connected} currentUserId="responder-1" onClose={vi.fn()} onCancelled={onCancelled} />,
        );

        // Cancel opens a confirmation; no RPC until confirmed.
        await user.click(screen.getByRole("button", { name: "Cancel connection" }));
        expect(screen.getByText("Cancel this connection?")).toBeInTheDocument();
        expect(rpc).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "Yes, cancel" }));
        await waitFor(() => expect(rpc).toHaveBeenCalledWith("unclaim", { p_claim_id: "conn-9" }));
        // The seeker loses a responder and had no way of knowing before this.
        expect(notify).toHaveBeenCalledWith({ notification_type: "connection_withdrawn", claim_id: "conn-9" });
        expect(onCancelled).toHaveBeenCalled();
    });

    it("dismisses the confirmation without cancelling on 'No, keep it'", async () => {
        const user = userEvent.setup();
        const connected = { ...regularPost, user_claim_status: "pending" as const, user_claim_id: "conn-9" };

        render(<RegularPlaySheet post={connected} currentUserId="responder-1" onClose={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Cancel connection" }));
        await user.click(screen.getByRole("button", { name: "No, keep it" }));
        expect(rpc).not.toHaveBeenCalled();
        expect(screen.getByText(/You're connected/)).toBeInTheDocument();
    });

    it("shows a read-only closed thread once the seeker removed the post", () => {
        const closed = { ...regularPost, status: "deleted", user_claim_status: "pending" as const, user_claim_id: "conn-3" };
        render(
            <RegularPlaySheet
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

/**
 * The Connect button wears regular play's blue, the same token as the card's
 * left accent bar. Pinned as a pair: if either moves off bg-blue-500 they stop
 * matching, which is the whole point of the change.
 */
describe("Connect button colour", () => {
    it("is the card's blue, not the brand green", () => {
        render(<RegularPlaySheet post={regularPost} currentUserId="responder-1" onClose={vi.fn()} />);
        const connect = screen.getByRole("button", { name: "Connect" });
        expect(connect.className).toContain("bg-blue-500");
        expect(connect.className).not.toContain("bg-brand-500");
        expect(connect.className).toContain("enabled:hover:bg-blue-600");
    });
});
