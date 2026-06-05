import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Activity } from "@/pages/activity";
import { supabase } from "@/lib/supabase";
import * as notifications from "@/lib/notifications";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc: vi.fn(),
        from: vi.fn(),
        functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
    },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "poster-1" }, loading: false }),
}));

vi.mock("@/lib/notifications", () => ({
    sendNotification: vi.fn(),
    sendNotificationBatch: vi.fn(),
}));

const rpc = vi.mocked(supabase.rpc);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const activePost = {
    id: "post-1",
    post_type: "sub_need",
    format: "point_play",
    game_date: "2026-04-10",
    game_time: "09:00",
    location: "Longshore Club",
    custom_court: null,
    cost: 40,
    original_cost: null,
    spots_total: 2,
    spots_available: 1,
    status: "active",
    created_at: "2026-04-06T12:00:00Z",
    series_id: null,
    deleted_at: null,
    deleted_by: null,
    claims: [
        {
            id: "claim-1",
            status: "pending",
            created_at: "2026-04-06T13:00:00Z",
            claimer_id: "claimer-1",
            first_name: "Jane",
            last_name: "Doe",
            photo_url: null,
            skill_level: "3.5",
            venmo_handle: "janedoe",
            phone: "203-555-0101",
        },
    ],
};

const expiredPost = { ...activePost, id: "post-2", status: "expired", claims: [] };

const deletedPost = {
    ...activePost,
    id: "post-3",
    status: "deleted",
    deleted_at: "2026-04-07T00:00:00Z",
    deleted_by: "poster-1",
    claims: [],
};

const seriesPost1 = {
    ...activePost,
    id: "s-1",
    series_id: "series-abc",
    game_date: "2026-04-08",
    claims: [{ ...activePost.claims[0], id: "sc-1", status: "approved" }],
};

const seriesPost2 = {
    ...activePost,
    id: "s-2",
    series_id: "series-abc",
    game_date: "2026-04-09",
    claims: [],
};

const seriesPost3 = {
    ...activePost,
    id: "s-3",
    series_id: "series-abc",
    game_date: "2026-04-10",
    claims: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMock(posts: unknown[]) {
    rpc.mockImplementation(((fn: string) => {
        if (fn === "get_my_posts_with_claims") return Promise.resolve({ data: posts, error: null });
        if (fn === "get_my_claims_with_posts") return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: { success: true }, error: null });
    }) as typeof rpc);
}

/** Set up supabase.from() to handle update/select chains used during cancellation */
function setupFromMock() {
    const fromMock = vi.mocked(supabase.from);
    fromMock.mockImplementation((() => ({
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
        }),
    })) as unknown as typeof fromMock);
}

beforeEach(() => {
    rpc.mockReset();
    vi.mocked(supabase.from).mockReset();
    vi.mocked(notifications.sendNotificationBatch).mockClear();
    vi.mocked(notifications.sendNotification).mockClear();
    setupFromMock();
});

// ---------------------------------------------------------------------------
// Basic cancellation
// ---------------------------------------------------------------------------

describe("cancellation flow — basic", () => {
    it("cancel button shown on own active posts", async () => {
        setupMock([activePost]);
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        expect(await screen.findByText("Cancel post")).toBeInTheDocument();
    });

    it("cancel button NOT shown on already-cancelled posts", async () => {
        setupMock([deletedPost]);
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        // Wait for the component to render fully — look for the Cancelled badge
        await screen.findByText("Cancelled");
        expect(screen.queryByText("Cancel post")).not.toBeInTheDocument();
    });

    it("cancel button NOT shown on expired posts", async () => {
        setupMock([expiredPost]);
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        await screen.findByText("Expired");
        expect(screen.queryByText("Cancel post")).not.toBeInTheDocument();
    });

    it("cancel confirmation shows correct copy", async () => {
        setupMock([activePost]);
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        await user.click(await screen.findByText("Cancel post"));

        // Claimer notification warning
        expect(
            screen.getByText(/All pending and approved claimers will be notified/),
        ).toBeInTheDocument();

        // Venmo refund reminder
        expect(
            screen.getByText(/coordinate directly with your sub to arrange a refund/),
        ).toBeInTheDocument();
    });

    it("confirming cancel soft-deletes the post", async () => {
        setupMock([activePost]);
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        await user.click(await screen.findByText("Cancel post"));
        await user.click(screen.getByText("Yes, cancel post"));

        await waitFor(() => {
            const fromMock = vi.mocked(supabase.from);
            expect(fromMock).toHaveBeenCalledWith("posts");

            // Find the update call — from("posts") returns an object with .update()
            const postsCall = fromMock.mock.results.find((_r, i) => fromMock.mock.calls[i][0] === "posts");
            expect(postsCall).toBeDefined();
            const updateFn = postsCall!.value.update;
            expect(updateFn).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: "deleted",
                    deleted_by: "poster-1",
                }),
            );
            // deleted_at should be set (an ISO string)
            const updateArg = updateFn.mock.calls[0][0];
            expect(updateArg.deleted_at).toBeDefined();
            expect(typeof updateArg.deleted_at).toBe("string");
        });
    });

    it("dismissing cancel does nothing", async () => {
        setupMock([activePost]);
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        await user.click(await screen.findByText("Cancel post"));
        await user.click(screen.getByText("Keep post"));

        // The from("posts").update() should NOT have been called
        expect(vi.mocked(supabase.from)).not.toHaveBeenCalledWith("posts");
    });
});

// ---------------------------------------------------------------------------
// Cancellation notifications
// ---------------------------------------------------------------------------

describe("cancellation flow — notifications", () => {
    it("cancellation notifies pending claimers", async () => {
        setupMock([activePost]);

        // Mock from("claims") to return active claimers
        const fromMock = vi.mocked(supabase.from);
        fromMock.mockImplementation(((table: string) => {
            if (table === "claims") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({
                                data: [{ claimer_id: "claimer-1" }],
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            // "posts" table for update
            return {
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            };
        }) as unknown as typeof fromMock);

        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        await user.click(await screen.findByText("Cancel post"));
        await user.click(screen.getByText("Yes, cancel post"));

        await waitFor(() => {
            expect(notifications.sendNotificationBatch).toHaveBeenCalledWith(
                ["claimer-1"],
                "claimer_backed_out",
                "post-1",
                expect.any(Object),
            );
        });
    });

    it("cancellation notification includes Venmo refund reminder", async () => {
        setupMock([activePost]);

        const fromMock = vi.mocked(supabase.from);
        fromMock.mockImplementation(((table: string) => {
            if (table === "claims") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({
                                data: [{ claimer_id: "claimer-1" }],
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            return {
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            };
        }) as unknown as typeof fromMock);

        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        await user.click(await screen.findByText("Cancel post"));
        await user.click(screen.getByText("Yes, cancel post"));

        await waitFor(() => {
            const batchCall = vi.mocked(notifications.sendNotificationBatch).mock.calls[0];
            expect(batchCall).toBeDefined();
            const data = batchCall[3];
            expect(data).toBeDefined();
            expect(data!.post_summary).toMatch(/Venmo/);
            expect(data!.post_summary).toMatch(/refund/);
        });
    });
});

// ---------------------------------------------------------------------------
// Series cancellation
// ---------------------------------------------------------------------------

describe("cancellation flow — series", () => {
    it("series cancel prompt shown for series posts", async () => {
        setupMock([seriesPost1, seriesPost2, seriesPost3]);
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );

        // Find all Cancel post buttons and click on one for a series post (seriesPost2)
        const cancelButtons = await screen.findAllByText("Cancel post");
        // seriesPost2 has no claims so it renders — click the one for a series post without approved claims
        // Posts render in order, so the second "Cancel post" button is for seriesPost2
        await user.click(cancelButtons[1]);

        expect(screen.getByText("This date only")).toBeInTheDocument();
        expect(screen.getByText("All future dates")).toBeInTheDocument();
    });

    it("series cancel does not show series prompt for non-series posts", async () => {
        setupMock([activePost]);
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <Activity />
            </MemoryRouter>,
        );
        await user.click(await screen.findByText("Cancel post"));

        // Non-series posts show "Yes, cancel post" instead of series options
        expect(screen.getByText("Yes, cancel post")).toBeInTheDocument();
        expect(screen.queryByText("This date only")).not.toBeInTheDocument();
    });
});
