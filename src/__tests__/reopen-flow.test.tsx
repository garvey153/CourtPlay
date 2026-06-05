import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Activity } from "@/pages/activity";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn() },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "poster-1" }, loading: false }),
}));

const rpc = vi.mocked(supabase.rpc);

const approvedPost = {
    id: "post-1", post_type: "sub_need", format: "point_play",
    game_date: "2026-04-10", game_time: "09:00", location: "Longshore Club",
    custom_court: null, cost: 25, spots_total: 2, spots_available: 1,
    status: "active", created_at: "2026-04-06T12:00:00Z",
    claims: [{
        id: "claim-1", status: "approved", created_at: "2026-04-06T13:00:00Z",
        claimer_id: "claimer-1", first_name: "Jane", last_name: "Doe",
        photo_url: null, skill_level: "3.5", venmo_handle: "janedoe", phone: "203-555-0101",
    }],
};

const pendingOnlyPost = {
    ...approvedPost,
    claims: [{
        ...approvedPost.claims[0],
        status: "pending",
    }],
};

function setupMock(posts: unknown[]) {
    rpc.mockImplementation(((fn: string) => {
        if (fn === "get_my_posts_with_claims") return Promise.resolve({ data: posts, error: null });
        if (fn === "get_my_claims_with_posts") return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: { success: true }, error: null });
    }) as typeof rpc);
}

beforeEach(() => { rpc.mockReset(); });

describe("reopen flow", () => {
    it("reopen button shown on approved claims", async () => {
        setupMock([approvedPost]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        expect(await screen.findByText("Reopen spot")).toBeInTheDocument();
    });

    it("reopen button NOT shown on pending claims", async () => {
        setupMock([pendingOnlyPost]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await screen.findByText("Approve");
        expect(screen.queryByText("Reopen spot")).not.toBeInTheDocument();
    });

    it("reopen confirmation shown on tap", async () => {
        setupMock([approvedPost]);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByText("Reopen spot"));
        expect(screen.getByText("Reopen?")).toBeInTheDocument();
    });

    it("reopen calls reopen_claim RPC", async () => {
        setupMock([approvedPost]);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByText("Reopen spot"));
        await user.click(screen.getByText("Yes"));
        await waitFor(() => {
            expect(rpc).toHaveBeenCalledWith("reopen_claim", { p_claim_id: "claim-1" });
        });
    });

    it("reopen refetches data after success", async () => {
        setupMock([approvedPost]);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByText("Reopen spot"));
        await user.click(screen.getByText("Yes"));
        await waitFor(() => {
            // After reopen, fetchData is called again which calls get_my_posts_with_claims
            const calls = rpc.mock.calls.filter((c) => c[0] === "get_my_posts_with_claims");
            expect(calls.length).toBeGreaterThanOrEqual(2);
        });
    });
});
