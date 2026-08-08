import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import { AdminGroups } from "@/pages/admin/admin-groups";
import { AdminGroupSheet } from "@/pages/admin/admin-group-sheet";
import type { AdminGroupRow } from "@/pages/admin/admin-group-card";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn(), from: vi.fn() },
}));

vi.mock("@/lib/notifications", () => ({ sendNotification: vi.fn() }));

const GROUPS: AdminGroupRow[] = [
    {
        id: "g1", name: "The Racquettes", details: "Westport Social League",
        created_at: "2026-08-01T00:00:00Z", closed_at: null,
        creator_id: "u1", creator_name: "Chris B.", member_count: 3,
    },
    {
        id: "g2", name: "Sunday Doubles", details: null,
        created_at: "2026-07-01T00:00:00Z", closed_at: "2026-08-01T00:00:00Z",
        creator_id: "u2", creator_name: "Sara H.", member_count: 1,
    },
];

const ROSTER = {
    id: "g1", name: "The Racquettes", details: null, created_at: "2026-08-01T00:00:00Z",
    closed_at: null, creator_id: "u1",
    members: [
        { id: "u1", first_name: "Chris", last_name: "Brown", photo_url: null, skill_level: "4.0", is_creator: true },
        { id: "u3", first_name: "Mike", last_name: "Chen", photo_url: null, skill_level: "3.5", is_creator: false },
    ],
};

/** Route each RPC to its own canned answer, so a test can assert on the call. */
function mockRpc(overrides: Record<string, unknown> = {}) {
    vi.mocked(supabase.rpc).mockImplementation(((fn: string) => {
        const table: Record<string, unknown> = {
            admin_get_groups: GROUPS,
            admin_get_group: ROSTER,
            admin_add_group_member: { success: true },
            admin_remove_group_member: { success: true },
            admin_delete_group: { success: true },
            search_users: [],
            ...overrides,
        };
        return Promise.resolve({ data: table[fn] ?? null, error: null });
    }) as typeof supabase.rpc);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockRpc();
});

describe("AdminGroups — list", () => {
    it("lists every group with its creator and player count", async () => {
        render(<AdminGroups />);
        expect(await screen.findByText("The Racquettes")).toBeInTheDocument();
        expect(screen.getByText(/Chris B\. · 3 players/)).toBeInTheDocument();
    });

    it("marks a closed group rather than hiding it — an admin looking into a report needs to see it", async () => {
        render(<AdminGroups />);
        expect(await screen.findByText("Sunday Doubles")).toBeInTheDocument();
        expect(screen.getByText("Closed")).toBeInTheDocument();
    });

    it("singularises the count for a one-player group", async () => {
        render(<AdminGroups />);
        await screen.findByText("Sunday Doubles");
        expect(screen.getByText(/1 player$/)).toBeInTheDocument();
    });

    it("searches across name and creator", async () => {
        const user = userEvent.setup();
        render(<AdminGroups />);
        await screen.findByText("The Racquettes");

        await user.type(screen.getByPlaceholderText("Search groups"), "sara");
        expect(screen.getByText("Sunday Doubles")).toBeInTheDocument();
        expect(screen.queryByText("The Racquettes")).not.toBeInTheDocument();
    });

    it("reads through admin_get_groups, not a direct table select", async () => {
        render(<AdminGroups />);
        await screen.findByText("The Racquettes");
        expect(supabase.rpc).toHaveBeenCalledWith("admin_get_groups");
        expect(supabase.from).not.toHaveBeenCalled();
    });
});

describe("AdminGroupSheet", () => {
    const open = (props: Partial<React.ComponentProps<typeof AdminGroupSheet>> = {}) =>
        render(
            <AdminGroupSheet group={GROUPS[0]} onClose={vi.fn()} onSaved={vi.fn()} {...props} />,
        );

    it("labels the creator and offers Remove on everyone else", async () => {
        open();
        expect(await screen.findByText("Owner")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
        // One Remove, not two — the creator must not have one.
        expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
    });

    it("removes through the RPC and tells the player", async () => {
        const user = userEvent.setup();
        open();
        await user.click(await screen.findByRole("button", { name: "Remove" }));

        await waitFor(() =>
            expect(supabase.rpc).toHaveBeenCalledWith("admin_remove_group_member", {
                p_group_id: "g1",
                p_user_id: "u3",
            }),
        );
        expect(sendNotification).toHaveBeenCalledWith({
            notification_type: "group_removed",
            group_id: "g1",
            target_user_id: "u3",
        });
    });

    it("closes itself when the removal empties the group", async () => {
        const onClose = vi.fn();
        mockRpc({ admin_remove_group_member: { success: true, group_emptied: true } });
        const user = userEvent.setup();
        open({ onClose });
        await user.click(await screen.findByRole("button", { name: "Remove" }));
        // The group is deleted server-side once empty, so there is nothing to
        // reload into.
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("surfaces a refusal instead of pretending it worked", async () => {
        mockRpc({ admin_remove_group_member: { success: false, error: "Not a member of this group" } });
        const user = userEvent.setup();
        open();
        await user.click(await screen.findByRole("button", { name: "Remove" }));
        expect(await screen.findByText("Not a member of this group")).toBeInTheDocument();
        expect(sendNotification).not.toHaveBeenCalled();
    });

    it("adds a player through the RPC and tells them", async () => {
        mockRpc({
            search_users: [{ id: "u9", first_name: "Sara", last_name: "Hill", photo_url: null, skill_level: "4.0" }],
        });
        const user = userEvent.setup();
        open();
        await screen.findByText("Owner");

        await user.type(screen.getByLabelText("Add a player"), "sara");
        await user.click(await screen.findByRole("button", { name: /Sara H\./ }));

        await waitFor(() =>
            expect(supabase.rpc).toHaveBeenCalledWith("admin_add_group_member", {
                p_group_id: "g1",
                p_user_id: "u9",
            }),
        );
        expect(sendNotification).toHaveBeenCalledWith({
            notification_type: "group_added",
            group_id: "g1",
            target_user_id: "u9",
        });
    });

    it("puts deletion behind a confirm", async () => {
        const user = userEvent.setup();
        open();
        await user.click(await screen.findByRole("button", { name: "Delete group" }));

        // First press only reveals the confirm — nothing has been called yet.
        expect(supabase.rpc).not.toHaveBeenCalledWith("admin_delete_group", expect.anything());
        expect(screen.getByText("Delete this group?")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Delete group" }));
        await waitFor(() =>
            expect(supabase.rpc).toHaveBeenCalledWith("admin_delete_group", { p_group_id: "g1" }),
        );
    });

    it("tells the members when the group is deleted, but not the creator", async () => {
        const user = userEvent.setup();
        open();
        await user.click(await screen.findByRole("button", { name: "Delete group" }));
        await user.click(screen.getByRole("button", { name: "Delete group" }));

        await waitFor(() => expect(sendNotification).toHaveBeenCalled());
        const targets = vi.mocked(sendNotification).mock.calls.map((c) => c[0].target_user_id);
        expect(targets).toEqual(["u3"]);
    });
});
