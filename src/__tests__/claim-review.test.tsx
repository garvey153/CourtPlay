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

const postWithPendingClaim = {
    id: "post-1", post_type: "sub_need", format: "point_play",
    game_date: "2026-04-10", game_time: "09:00", location: "Longshore Club",
    custom_court: null, cost: 25, spots_total: 2, spots_available: 1,
    status: "active", created_at: "2026-04-06T12:00:00Z",
    claims: [{
        id: "claim-1", status: "pending", created_at: "2026-04-06T13:00:00Z",
        claimer_id: "claimer-1", first_name: "Jane", last_name: "Doe",
        photo_url: null, skill_level: "3.5", venmo_handle: "janedoe", phone: "203-555-0101",
    }],
};

const postWithNoClaims = {
    ...postWithPendingClaim,
    claims: [],
};

function setupMock(posts: unknown[]) {
    rpc.mockImplementation(((fn: string) => {
        if (fn === "get_my_posts_with_claims") return Promise.resolve({ data: posts, error: null });
        if (fn === "get_my_claims_with_posts") return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: { success: true }, error: null });
    }) as typeof rpc);
}

beforeEach(() => { rpc.mockReset(); });

describe("claim review section", () => {
    it("pending claims section shown on posts with pending claims", async () => {
        setupMock([postWithPendingClaim]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        expect(await screen.findByText("1 pending claim")).toBeInTheDocument();
    });

    it("no claims message shown when no claims", async () => {
        setupMock([postWithNoClaims]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        expect(await screen.findByText("No claims yet.")).toBeInTheDocument();
    });

    it("pending claimer shows name and skill level", async () => {
        setupMock([postWithPendingClaim]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
        expect(screen.getByText("3.5 NTRP")).toBeInTheDocument();
    });

    it("approve and reject buttons shown for pending claims", async () => {
        setupMock([postWithPendingClaim]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        expect(await screen.findByText("Approve")).toBeInTheDocument();
        expect(screen.getByText("Reject")).toBeInTheDocument();
    });

    it("reject shows reason options", async () => {
        setupMock([postWithPendingClaim]);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByText("Reject"));
        expect(screen.getByText("Wrong skill level")).toBeInTheDocument();
        expect(screen.getByText("Already filled")).toBeInTheDocument();
        expect(screen.getByText("Other")).toBeInTheDocument();
    });

    it("approve calls approve_claim RPC", async () => {
        setupMock([postWithPendingClaim]);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByText("Approve"));
        await waitFor(() => {
            expect(rpc).toHaveBeenCalledWith("approve_claim", { p_claim_id: "claim-1" });
        });
    });
});
