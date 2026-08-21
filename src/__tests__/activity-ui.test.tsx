import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Activity } from "@/pages/activity";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/components/base/buttons/cta";
import { KIND_CONFIG } from "@/components/app/sub-card";
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
    /**
     * An expired regular-play post had no way back: editing does not reset
     * expires_at (post-new.tsx sets it on insert only), so the post stayed off
     * the feed whatever the author did.
     */
    describe("expired regular-play post", () => {
        const expiredRegular = {
            id: "rg-1", post_type: "regular_game", status: "expired", format: null,
            play_type: null, duration: null, skill_level: "4.0", notes: null,
            game_date: null, game_time: null, location: "Longshore Club", custom_court: null,
            cost: null, original_cost: null, created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() - 86400000).toISOString(),
            preferred_days: ["Mon"], preferred_times: ["Evening"], claims: [],
        };

        /**
         * The bar and the badge have to agree. An expired post inherited its
         * section's kind — "open" under Active — so the bar showed the post
         * TYPE's colour while the badge said Expired.
         */
        it("gives the card a red bar, not the post type's colour", async () => {
            setup([expiredRegular], []);
            const { container } = render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));
            // "Expired" appears twice now: the section heading and the badge.
            await waitFor(() => expect(screen.getAllByText("Expired").length).toBeGreaterThan(1));

            const bars = [...container.querySelectorAll("span.w-1")];
            expect(bars.length).toBeGreaterThan(0);
            for (const bar of bars) {
                expect(bar.className).toContain(KIND_CONFIG.expired.bar);
                expect(bar.className).not.toContain("bg-blue-500");
            }
        });

        it("badges the card as Expired, under an Expired section", async () => {
            setup([expiredRegular], []);
            render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));

            // The section heading and the card's own badge.
            await waitFor(() => expect(screen.getAllByText("Expired")).toHaveLength(2));
            // And it is no longer filed under Active, which said it was live.
            expect(screen.queryByText("Active")).not.toBeInTheDocument();
        });

        it("dims an expired regular-play card's text, like a sub card", async () => {
            setup([expiredRegular], []);
            render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));

            const title = await screen.findByText("Tennis, Regular Play · NTRP 4.0");
            expect(title.className).toContain("text-tertiary");
            expect(title.className).not.toContain("text-primary");
        });

        /** Editing a game that has been and gone is not a thing anyone wants. */
        it("offers Remove, not Edit, on an expired sub post", async () => {
            const yesterday = new Date(Date.now() - 26 * 3600 * 1000).toISOString().slice(0, 10);
            setup([{ ...createdPost, game_date: yesterday, claims: [] }], []);
            render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));
            const card = (await screen.findByText(/Longshore Club/)).closest("button")!;
            await userEvent.click(card);

            expect(await screen.findByRole("button", { name: "Remove post" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Edit post" })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Delete post" })).not.toBeInTheDocument();
        });

        /**
         * A past-dated sub post used to land in NO section — Active excludes
         * past games and nothing else claimed it — so it vanished from the tab
         * rather than showing as expired.
         */
        it("keeps a past-dated sub post visible, as expired", async () => {
            const yesterday = new Date(Date.now() - 26 * 3600 * 1000).toISOString().slice(0, 10);
            setup([{ ...createdPost, game_date: yesterday, claims: [] }], []);
            render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));

            await waitFor(() => expect(screen.getAllByText("Expired").length).toBeGreaterThan(0));
            expect(screen.queryByText("It's your serve")).not.toBeInTheDocument();
        });

        it("offers Reactivate as the primary action, with Edit demoted", async () => {
            setup([expiredRegular], []);
            render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));
            await userEvent.click(await screen.findByText("Tennis, Regular Play · NTRP 4.0"));

            const reactivate = await screen.findByRole("button", { name: "Reactivate post" });
            const edit = screen.getByRole("button", { name: "Edit post" });
            const remove = screen.getByRole("button", { name: "Remove post" });

            expect(reactivate.className).toContain("bg-brand-500");
            // Edit now carries exactly the same treatment as Remove.
            expect(edit.className).toBe(remove.className);
        });

        it("calls reactivate_post rather than writing status from the client", async () => {
            setup([expiredRegular], []);
            render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));
            await userEvent.click(await screen.findByText("Tennis, Regular Play · NTRP 4.0"));
            await userEvent.click(await screen.findByRole("button", { name: "Reactivate post" }));

            // The cron re-expires anything active whose expires_at has passed, so
            // only the server may do this — it moves the date with the status.
            expect(rpc).toHaveBeenCalledWith("reactivate_post", { p_post_id: "rg-1" });
        });

        it("offers no Reactivate while the post is still active", async () => {
            setup([{ ...expiredRegular, status: "active" }], []);
            render(<MemoryRouter><Activity /></MemoryRouter>);
            await userEvent.click(await screen.findByRole("button", { name: "Created posts" }));
            await userEvent.click(await screen.findByText("Tennis, Regular Play · NTRP 4.0"));
            expect(screen.queryByRole("button", { name: "Reactivate post" })).not.toBeInTheDocument();
            expect(screen.queryByText("Expired")).not.toBeInTheDocument();
        });
    });

    /**
     * Both Activity empty states used to pass actionTone="secondary", so their
     * calls to action were outlined while the identical ones on Feed and Profile
     * were solid green. Pinning the shared PRIMARY_CTA constant rather than a
     * class string means a change to the design token moves this test with it.
     */
    it("empty states use the same primary CTA as Feed and Profile", async () => {
        const user = userEvent.setup();
        setup([], []);
        render(<MemoryRouter><Activity /></MemoryRouter>);

        const answered = await screen.findByRole("link", { name: "Browse the feed" });
        expect(answered.className).toContain(PRIMARY_CTA);
        expect(answered.className).not.toContain(SECONDARY_CTA);

        await user.click(screen.getByRole("button", { name: "Created posts" }));
        const created = await screen.findByRole("link", { name: "Find a sub" });
        expect(created.className).toContain(PRIMARY_CTA);
        expect(created.className).not.toContain(SECONDARY_CTA);
    });

    it("renders pill tabs and claimed-post cards", async () => {
        setup([], [myClaim]);
        render(<MemoryRouter><Activity /></MemoryRouter>);
        expect(await screen.findByRole("button", { name: "Answered posts" })).toBeInTheDocument();
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

    it("created tab: an approved claim badges as Approved, in the Claimed colours", async () => {
        // Two halves that have to disagree. The poster's spot is GONE, so the
        // card keeps the neutral Claimed treatment rather than the brand-green
        // still-open one "Approved" carries on the Answered tab. But the word
        // has to say what happened, and what happened is approval.
        const approvedPost = { ...createdPost, claims: [{ ...createdPost.claims[0], status: "approved" }] };
        setup([approvedPost], []);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByRole("button", { name: "Created posts" }));
        await screen.findByText(/Round Robin Tennis/);
        const card = screen.getByText(/Round Robin Tennis/).closest("button")!;
        expect(card).toHaveTextContent("Approved");
        expect(card).not.toHaveTextContent("Claimed");

        // Colours come from the "claimed" kind, not from "approved".
        const badge = within(card).getByText("Approved");
        expect(badge.className).toContain("bg-neutral-800");
        expect(badge.className).toContain("text-neutral-400");
        expect(badge.className).not.toContain("brand");
    });

    it("created post with no claims shows Edit / Delete actions in the sheet", async () => {
        setup([{ ...createdPost, spots_available: 1, claims: [] }], []);
        const user = userEvent.setup();
        render(<MemoryRouter><Activity /></MemoryRouter>);
        await user.click(await screen.findByRole("button", { name: "Created posts" }));
        await user.click(await screen.findByText(/Round Robin Tennis/));
        expect(await screen.findByRole("button", { name: "Edit post" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Delete post" })).toBeInTheDocument();
    });
});
