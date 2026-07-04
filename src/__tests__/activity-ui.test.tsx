import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Activity } from "@/pages/activity";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn(), from: vi.fn(() => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) })) },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me-1" }, loading: false }) }));
vi.mock("@/hooks/use-profile", () => ({
    useProfile: () => ({ profile: { id: "me-1", first_name: "Me", last_name: "User", photo_url: null } }),
}));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const rpc = vi.mocked(supabase.rpc);

const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const createdPost = {
    id: "post-1", post_type: "sub_need", format: null, play_type: "round_robin", duration: 2,
    skill_level: "4.0", notes: "Come play", game_date: futureDate, game_time: "09:00",
    location: "Longshore Club", custom_court: null, cost: 25, original_cost: null,
    spots_total: 1, spots_available: 0, status: "active", created_at: "2026-07-01T12:00:00Z",
    series_id: null, deleted_at: null, deleted_by: null,
    claims: [{
        id: "claim-1", status: "pending", created_at: "2026-07-01T13:00:00Z", claimer_id: "c-1",
        first_name: "Mike", last_name: "Chen", photo_url: null, skill_level: "3.5", venmo_handle: "mike", phone: "203",
    }],
};

const myClaim = {
    id: "myclaim-1", status: "pending", created_at: "2026-07-01T14:00:00Z", rejection_reason: null,
    post_id: "post-2", post_type: "sub_need", post_status: "active", format: null, play_type: "doubles",
    duration: 2, skill_level: "4.5", notes: "x", game_date: "2026-07-12", game_time: "09:00",
    location: "Westport", custom_court: null, cost: 20, poster_id: "p-1", poster_first_name: "Chris",
    poster_last_name: "B", poster_photo_url: null, poster_venmo_handle: "chris", poster_phone: "203",
};

function setup(posts: unknown[], claims: unknown[]) {
    rpc.mockImplementation(((fn: string) => {
        if (fn === "get_my_posts_with_claims") return Promise.resolve({ data: posts, error: null });
        if (fn === "get_my_claims_with_posts") return Promise.resolve({ data: claims, error: null });
        return Promise.resolve({ data: { success: true }, error: null });
    }) as typeof rpc);
}

beforeEach(() => rpc.mockReset());

describe("Activity redesign", () => {
    it("renders pill tabs and claimed-post cards", async () => {
        setup([], [myClaim]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        expect(await screen.findByRole("button", { name: "Claimed posts" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Created posts" })).toBeInTheDocument();
        // Feed-style card title
        expect(await screen.findByText(/Doubles Tennis/)).toBeInTheDocument();
    });

    it("tapping a pending claim opens the claim sheet with Cancel claim", async () => {
        setup([], [myClaim]);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByText(/Doubles Tennis/));
        expect(await screen.findByText("Your claim is pending approval")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancel claim" })).toBeInTheDocument();
    });

    it("created tab: tapping a claimed post opens the creator sheet with Approve/Decline", async () => {
        setup([createdPost], []);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByRole("button", { name: "Created posts" }));
        await user.click(await screen.findByText(/Round Robin Tennis/));
        expect(await screen.findByText("Your post has been claimed!")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Approve claim" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    });

    it("approving a claim calls approve_claim", async () => {
        setup([createdPost], []);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByRole("button", { name: "Created posts" }));
        await user.click(await screen.findByText(/Round Robin Tennis/));
        await user.click(await screen.findByRole("button", { name: "Approve claim" }));
        expect(rpc).toHaveBeenCalledWith("approve_claim", { p_claim_id: "claim-1" });
    });

    it("created post with no claims shows 'No claims yet.' in the sheet", async () => {
        setup([{ ...createdPost, spots_available: 1, claims: [] }], []);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByRole("button", { name: "Created posts" }));
        await user.click(await screen.findByText(/Round Robin Tennis/));
        expect(await screen.findByText("No claims yet.")).toBeInTheDocument();
    });
});
