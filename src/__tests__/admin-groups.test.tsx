import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import { AdminGroups } from "@/pages/admin/admin-groups";
import { GroupFormSheet } from "@/components/app/group-form-sheet";
import { AdminGroupDeleteSheet } from "@/pages/admin/admin-group-delete-sheet";
import type { AdminGroupRow } from "@/pages/admin/admin-group-card";

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn(), from: vi.fn() },
}));

vi.mock("@/lib/notifications", () => ({ sendNotification: vi.fn() }));

vi.mock("@/hooks/use-profile", () => ({
    useProfile: () => ({ profile: { id: "admin-1", first_name: "Admin", last_name: "U", photo_url: null, skill_level: "4.0" } }),
}));

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
    id: "g1", name: "The Racquettes", details: "Westport Social League", created_at: "2026-08-01T00:00:00Z",
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
            admin_update_group: { success: true },
            get_group: ROSTER,
            update_group: { success: true },
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

    it("the delete confirmation opens ON TOP of the edit screen, and backing out returns to it", async () => {
        const user = userEvent.setup();
        render(<AdminGroups />);
        await user.click(await screen.findByText("The Racquettes"));

        // Edit screen open.
        await screen.findByDisplayValue("The Racquettes");
        await user.click(screen.getByRole("button", { name: "Delete group" }));

        // Both on screen: the confirmation over a form that is still mounted.
        expect(await screen.findByText("Delete this group?")).toBeInTheDocument();
        expect(screen.getByDisplayValue("The Racquettes")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "No, keep it" }));

        // Back to the form, not to the list — mid-edit state survives.
        expect(screen.queryByText("Delete this group?")).not.toBeInTheDocument();
        expect(screen.getByDisplayValue("The Racquettes")).toBeInTheDocument();
    });

    it("deleting closes both — the form behind has nothing left to edit", async () => {
        const user = userEvent.setup();
        render(<AdminGroups />);
        await user.click(await screen.findByText("The Racquettes"));
        await screen.findByDisplayValue("The Racquettes");
        await user.click(screen.getByRole("button", { name: "Delete group" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "Yes, delete" })).not.toBeDisabled());
        await user.click(screen.getByRole("button", { name: "Yes, delete" }));

        await waitFor(() => expect(screen.queryByDisplayValue("The Racquettes")).not.toBeInTheDocument());
        expect(screen.queryByText("Delete this group?")).not.toBeInTheDocument();
    });

    it("reads through admin_get_groups, not a direct table select", async () => {
        render(<AdminGroups />);
        await screen.findByText("The Racquettes");
        expect(supabase.rpc).toHaveBeenCalledWith("admin_get_groups");
        expect(supabase.from).not.toHaveBeenCalled();
    });
});

/**
 * The admin editor IS the Edit group screen, in admin mode — same component,
 * so these tests are about the three things that differ: which RPCs it uses,
 * that edits are staged until Save, and Delete.
 */
describe("GroupFormSheet — admin mode", () => {
    const open = (props: Partial<React.ComponentProps<typeof GroupFormSheet>> = {}) =>
        render(
            <GroupFormSheet
                admin
                groupId="g1"
                onClose={vi.fn()}
                onSaved={vi.fn()}
                onRequestDelete={vi.fn()}
                {...props}
            />,
        );

    it("reads through admin_get_group — get_group refuses a non-member", async () => {
        open();
        await screen.findByDisplayValue("The Racquettes");
        expect(supabase.rpc).toHaveBeenCalledWith("admin_get_group", { p_group_id: "g1" });
        expect(supabase.rpc).not.toHaveBeenCalledWith("get_group", expect.anything());
    });

    it("is the Edit group screen: name, details and the member search", async () => {
        open();
        expect(await screen.findByDisplayValue("The Racquettes")).toBeInTheDocument();
        // By visible text: the base Input renders its label as a sibling node
        // rather than an htmlFor-associated one, so getByLabelText misses it.
        expect(screen.getByText("Group name")).toBeInTheDocument();
        expect(screen.getByText("Group details")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Search players")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("labels the creator and offers Remove on everyone else", async () => {
        open();
        expect(await screen.findByText("Owner")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
    });

    it("Save is disabled until something actually changes", async () => {
        const user = userEvent.setup();
        open();
        await screen.findByDisplayValue("The Racquettes");
        expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Remove" }));
        expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled();
    });

    it("re-adding someone you removed is not an edit", async () => {
        mockRpc({
            search_users: [{ id: "u3", first_name: "Mike", last_name: "Chen", photo_url: null, skill_level: "3.5" }],
        });
        const user = userEvent.setup();
        open();
        await screen.findByDisplayValue("The Racquettes");

        await user.click(screen.getByRole("button", { name: "Remove" }));
        await user.type(screen.getByPlaceholderText("Search players"), "mike");
        await user.click(await screen.findByRole("button", { name: /Mike C\./ }));

        // Same membership, different order — Save goes back to disabled.
        await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled());
    });

    it("staged: removing a player writes nothing until Save", async () => {
        const user = userEvent.setup();
        open();
        await user.click(await screen.findByRole("button", { name: "Remove" }));

        expect(screen.queryByText("Mike C.")).not.toBeInTheDocument();
        // The whole point of the Save button: nothing has gone to the server.
        expect(supabase.rpc).not.toHaveBeenCalledWith("admin_update_group", expect.anything());
        expect(sendNotification).not.toHaveBeenCalled();
    });

    it("saves the whole roster in one call, and tells only who changed", async () => {
        const user = userEvent.setup();
        open();
        await user.click(await screen.findByRole("button", { name: "Remove" }));
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() =>
            expect(supabase.rpc).toHaveBeenCalledWith("admin_update_group", {
                p_group_id: "g1",
                p_name: "The Racquettes",
                p_details: "Westport Social League",
                p_member_ids: [],
            }),
        );
        expect(sendNotification).toHaveBeenCalledTimes(1);
        expect(sendNotification).toHaveBeenCalledWith({
            notification_type: "group_removed",
            group_id: "g1",
            target_user_id: "u3",
        });
    });

    it("lets an admin edit the name and details", async () => {
        const user = userEvent.setup();
        open();
        const nameField = await screen.findByDisplayValue("The Racquettes");
        await user.clear(nameField);
        await user.type(nameField, "The Racketeers");
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() =>
            expect(supabase.rpc).toHaveBeenCalledWith(
                "admin_update_group",
                expect.objectContaining({ p_name: "The Racketeers" }),
            ),
        );
    });

    it("hands delete off instead of confirming in place", async () => {
        const onRequestDelete = vi.fn();
        const user = userEvent.setup();
        open({ onRequestDelete });

        await user.click(await screen.findByRole("button", { name: "Delete group" }));
        expect(onRequestDelete).toHaveBeenCalled();
        // The form itself never deletes — the confirmation sheet does.
        expect(supabase.rpc).not.toHaveBeenCalledWith("admin_delete_group", expect.anything());
    });

    it("offers no Delete outside admin mode", async () => {
        render(<GroupFormSheet groupId="g1" onClose={vi.fn()} onSaved={vi.fn()} />);
        await screen.findByDisplayValue("The Racquettes");
        expect(screen.queryByRole("button", { name: "Delete group" })).not.toBeInTheDocument();
    });

    it("the creator's Edit group shares the disabled-until-dirty rule", async () => {
        // Same component, so the change made for the admin screen lands on the
        // creator's too. Pinned here because that is the only thing keeping the
        // two screens identical.
        const user = userEvent.setup();
        render(<GroupFormSheet groupId="g1" onClose={vi.fn()} onSaved={vi.fn()} />);
        await screen.findByDisplayValue("The Racquettes");
        expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Remove" }));
        expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled();
        // …and it still writes through the creator RPC, not the admin one.
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("update_group", expect.anything()));
    });
});

describe("AdminGroupDeleteSheet", () => {
    const open = (props: Partial<React.ComponentProps<typeof AdminGroupDeleteSheet>> = {}) =>
        render(<AdminGroupDeleteSheet group={GROUPS[0]} onClose={vi.fn()} onDeleted={vi.fn()} {...props} />);

    it("names what is about to go, and says it cannot be undone", async () => {
        open();
        expect(screen.getByText("Delete this group?")).toBeInTheDocument();
        expect(screen.getByText("The Racquettes")).toBeInTheDocument();
        expect(screen.getByText(/Chris B\. · 3 players/)).toBeInTheDocument();
        expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
    });

    it("deletes and tells the members, but not the creator", async () => {
        const onDeleted = vi.fn();
        const user = userEvent.setup();
        open({ onDeleted });

        await waitFor(() => expect(screen.getByRole("button", { name: "Yes, delete" })).not.toBeDisabled());
        await user.click(screen.getByRole("button", { name: "Yes, delete" }));

        await waitFor(() =>
            expect(supabase.rpc).toHaveBeenCalledWith("admin_delete_group", { p_group_id: "g1" }),
        );
        const targets = vi.mocked(sendNotification).mock.calls.map((c) => c[0].target_user_id);
        expect(targets).toEqual(["u3"]);
        await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    });

    it("re-reads the roster rather than trusting unsaved form state", async () => {
        open();
        await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("admin_get_group", { p_group_id: "g1" }));
    });

    it("No, keep it closes without deleting", async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        open({ onClose });
        await user.click(screen.getByRole("button", { name: "No, keep it" }));
        expect(onClose).toHaveBeenCalled();
        expect(supabase.rpc).not.toHaveBeenCalledWith("admin_delete_group", expect.anything());
    });

    it("surfaces a refusal instead of reporting success", async () => {
        mockRpc({ admin_delete_group: { success: false, error: "Group not found" } });
        const onDeleted = vi.fn();
        const user = userEvent.setup();
        open({ onDeleted });
        await waitFor(() => expect(screen.getByRole("button", { name: "Yes, delete" })).not.toBeDisabled());
        await user.click(screen.getByRole("button", { name: "Yes, delete" }));
        expect(await screen.findByText("Group not found")).toBeInTheDocument();
        expect(onDeleted).not.toHaveBeenCalled();
    });
});
