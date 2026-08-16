import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GroupDetailSheet } from "@/components/app/group-detail-sheet";
import type { GroupSummary } from "@/types/groups";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("@/lib/notifications", () => ({ sendNotification: vi.fn() }));

const summary = {
    id: "g-1",
    name: "Tuesday Doubles",
    details: "Westport Social League",
    is_creator: true,
    is_closed: false,
    closed_at: null,
    joined_at: new Date().toISOString(),
    my_removed_at: null,
    removed_by_me: false,
    member_count: 2,
    members: [
        { id: "u-1", first_name: "Sara", last_name: "H", photo_url: null },
        { id: "u-2", first_name: "Mike", last_name: "C", photo_url: null },
    ],
} as unknown as GroupSummary;

/** A promise this test settles by hand, so nothing is left pending at teardown. */
function deferred<T>() {
    let settle!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        settle = res;
    });
    return { promise, settle };
}

const open = (props: Partial<{ initialGroup: GroupSummary }> = {}) =>
    render(
        <GroupDetailSheet groupId="g-1" onClose={() => {}} onChanged={() => {}} onEdit={() => {}} {...props} />,
    );

/**
 * Opening a group showed a spinner while get_group ran — for data Profile had
 * already fetched. get_my_groups returns everything the sheet displays except
 * each member's skill level, so it can paint immediately and fill the rest in.
 *
 * The seed is display-only. It carries no created_by, and closing a group
 * notifies every member EXCEPT the creator, so acting on the seed would tell the
 * creator their own group had closed. That separation is the thing to protect.
 */
describe("group sheet — opening", () => {
    beforeEach(() => rpc.mockReset());

    it("shows the group before get_group answers", async () => {
        const d = deferred<unknown>();
        rpc.mockReturnValue(d.promise);

        open({ initialGroup: summary });

        // Real content, no spinner, while the request is still in flight.
        expect(screen.getByText("Tuesday Doubles")).toBeInTheDocument();
        expect(screen.getByText(/2 players/)).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();

        d.settle({ data: { ...summary, created_by: "u-1", members: summary.members }, error: null });
        await waitFor(() => expect(screen.getByText("Tuesday Doubles")).toBeInTheDocument());
    });

    it("still spins on a cold open, with nothing to show", async () => {
        const d = deferred<unknown>();
        rpc.mockReturnValue(d.promise);

        open();
        expect(screen.getByRole("status")).toBeInTheDocument();

        d.settle({ data: { ...summary, created_by: "u-1" }, error: null });
        await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    });

    it("fills in what the seed could not carry", async () => {
        rpc.mockResolvedValue({
            data: {
                ...summary,
                created_by: "u-1",
                members: [{ id: "u-1", first_name: "Sara", last_name: "H", photo_url: null, skill_level: "4.0" }],
            },
            error: null,
        });

        open({ initialGroup: summary });
        expect(screen.getByText("Tuesday Doubles")).toBeInTheDocument();

        // Skill level is the field get_my_groups does not return. skillLabel maps
        // "4.0" to its word descriptor, which is what actually appears.
        await waitFor(() => expect(document.body.textContent).toContain("Intermediate+"));
    });

    /** A failed refresh must not replace content already on screen. */
    it("keeps the seed when the refresh fails", async () => {
        rpc.mockResolvedValue({ data: null, error: { message: "network" } });

        open({ initialGroup: summary });

        await waitFor(() => expect(rpc).toHaveBeenCalled());
        expect(screen.getByText("Tuesday Doubles")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
