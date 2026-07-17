import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegularConnectionsSheet } from "@/components/app/regular-connections-sheet";
import type { ClaimRow, MyPost } from "@/types/activity";

const poster = { first_name: "Sam", last_name: "Seeker", photo_url: null };

function makeConnection(id: string, first: string, lastMessage?: string): ClaimRow {
    return {
        id,
        status: "pending",
        created_at: new Date().toISOString(),
        claimer_id: `u-${id}`,
        first_name: first,
        last_name: "R",
        photo_url: null,
        skill_level: "4.0",
        venmo_handle: null,
        phone: null,
        messages: lastMessage
            ? [
                  {
                      id: `m-${id}`,
                      sender_id: `u-${id}`,
                      body: lastMessage,
                      created_at: new Date().toISOString(),
                      first_name: first,
                      last_name: "R",
                      photo_url: null,
                  },
              ]
            : [],
    };
}

function makePost(claims: ClaimRow[]): MyPost {
    return {
        id: "post-r1",
        post_type: "regular_game",
        format: null,
        play_type: null,
        duration: null,
        skill_level: "4.0",
        notes: "Looking to join a group.",
        game_date: null,
        game_time: null,
        location: "Longshore Club",
        custom_court: null,
        preferred_days: ["Mon"],
        preferred_times: ["Morning"],
        cost: null,
        original_cost: null,
        spots_total: 1,
        spots_available: 0,
        status: "active",
        created_at: new Date().toISOString(),
        series_id: null,
        deleted_at: null,
        deleted_by: null,
        claims,
    };
}

describe("RegularConnectionsSheet", () => {
    it("lists all conversations when 2+ people reached out, and opens one on tap", async () => {
        const post = makePost([makeConnection("c1", "Alice", "We play Mondays"), makeConnection("c2", "Bob", "Got a spot open")]);
        const user = userEvent.setup();
        render(
            <RegularConnectionsSheet post={post} poster={poster} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onReply={vi.fn()} />,
        );

        expect(screen.getByText("2 people reached out")).toBeInTheDocument();
        expect(screen.getByText("Alice R.")).toBeInTheDocument();
        expect(screen.getByText("We play Mondays")).toBeInTheDocument();
        expect(screen.getByText("Got a spot open")).toBeInTheDocument();

        await user.click(screen.getByText("Bob R."));
        // Thread view for Bob — reply field addressed to Bob.
        expect(await screen.findByPlaceholderText(/Bob/)).toBeInTheDocument();
    });

    it("opens the thread directly for a single connection (no list)", () => {
        const post = makePost([makeConnection("c1", "Alice", "We play Mondays")]);
        render(
            <RegularConnectionsSheet post={post} poster={poster} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onReply={vi.fn()} />,
        );
        // Straight into Alice's thread; no "reached out" list header. (ThreadMessage
        // wraps the body in curly quotes, so match a substring.)
        expect(screen.queryByText(/reached out/)).not.toBeInTheDocument();
        expect(screen.getByText(/We play Mondays/)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Alice/)).toBeInTheDocument();
    });

    it("sends a reply to the selected connection's thread", async () => {
        const onReply = vi.fn();
        const post = makePost([makeConnection("c1", "Alice", "We play Mondays")]);
        const user = userEvent.setup();
        render(
            <RegularConnectionsSheet post={post} poster={poster} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onReply={onReply} />,
        );

        await user.type(screen.getByLabelText("Reply"), "Sounds good!");
        await user.click(screen.getByRole("button", { name: "Send reply" }));
        expect(onReply).toHaveBeenCalledWith("c1", "Sounds good!");
    });

    it("removes the post after confirming", async () => {
        const onDelete = vi.fn();
        const post = makePost([]); // no connections → manage view
        const user = userEvent.setup();
        render(
            <RegularConnectionsSheet post={post} poster={poster} onClose={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} onReply={vi.fn()} />,
        );

        await user.click(screen.getByRole("button", { name: "Remove post" }));
        await user.click(screen.getByRole("button", { name: "Yes, remove" }));
        expect(onDelete).toHaveBeenCalled();
    });
});
