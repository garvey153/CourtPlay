import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUserDetailSheet } from "@/pages/admin/admin-user-detail-sheet";
import type { AdminUserRow } from "@/pages/admin/admin-user-card";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc,
        from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
    },
}));

const user = (over: Partial<AdminUserRow> = {}): AdminUserRow =>
    ({
        id: "u1",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        skill_level: 4,
        is_admin: false,
        is_suspended: true,
        created_at: "2026-01-01T00:00:00Z",
        photo_url: null,
        report_count: 0,
        ...over,
    }) as AdminUserRow;

const preview = (over: Record<string, unknown> = {}) => ({
    email: "jane@example.com",
    blockers: [],
    counts: { posts: 3, claims_made: 12, follows: 0, messages: 0 },
    ...over,
});

/**
 * Deleting is the irreversible half of moderation, so the things worth pinning
 * are the refusals, not the happy path: it must not be offered before
 * deactivation, and it must not be committable when the server says it would
 * destroy another player's data.
 */
describe("admin delete user", () => {
    beforeEach(() => rpc.mockReset());

    it("is not offered while the user is still active", () => {
        render(<AdminUserDetailSheet user={user({ is_suspended: false })} onClose={() => {}} onSaved={() => {}} />);
        expect(screen.queryByText("Delete from the system")).not.toBeInTheDocument();
        expect(screen.getByText("Deactivate user")).toBeInTheDocument();
    });

    it("is offered once deactivated", () => {
        render(<AdminUserDetailSheet user={user()} onClose={() => {}} onSaved={() => {}} />);
        expect(screen.getByText("Delete from the system")).toBeInTheDocument();
    });

    it("shows what would be deleted before committing", async () => {
        rpc.mockResolvedValue({ data: preview(), error: null });
        render(<AdminUserDetailSheet user={user()} onClose={() => {}} onSaved={() => {}} />);
        await userEvent.click(screen.getByText("Delete from the system"));

        await waitFor(() => expect(screen.getByText(/Delete Jane Doe from the system\?/)).toBeInTheDocument());
        expect(rpc).toHaveBeenCalledWith("admin_user_delete_preview", { p_user_id: "u1" });
        expect(screen.getByText("3 posts")).toBeInTheDocument();
        expect(screen.getByText("12 claims they made")).toBeInTheDocument();
        // Zero counts are left out rather than listed as "0 follows".
        expect(screen.queryByText(/0 follows/)).not.toBeInTheDocument();
    });

    /** The whole point of the guard: no confirm button at all when blocked. */
    it("cannot be committed when it would destroy another player's data", async () => {
        rpc.mockResolvedValue({
            data: preview({
                blockers: [
                    {
                        kind: "owns_groups",
                        message: "They created a group other players are in. Reassign or delete it first.",
                        groups: [{ name: "Tuesday Doubles", members: 6 }],
                    },
                ],
            }),
            error: null,
        });
        render(<AdminUserDetailSheet user={user()} onClose={() => {}} onSaved={() => {}} />);
        await userEvent.click(screen.getByText("Delete from the system"));

        await waitFor(() => expect(screen.getByText(/Reassign or delete it first/)).toBeInTheDocument());
        expect(screen.getByText(/Tuesday Doubles · 6 other members/)).toBeInTheDocument();
        expect(screen.queryByText("Yes, delete permanently")).not.toBeInTheDocument();
    });

    it("calls the delete RPC on confirm and reports a server refusal", async () => {
        rpc.mockResolvedValueOnce({ data: preview(), error: null });
        rpc.mockResolvedValueOnce({ data: { success: false, error: "Remove their admin access first." }, error: null });

        const onSaved = vi.fn();
        render(<AdminUserDetailSheet user={user()} onClose={() => {}} onSaved={onSaved} />);
        await userEvent.click(screen.getByText("Delete from the system"));
        await waitFor(() => expect(screen.getByText("Yes, delete permanently")).toBeInTheDocument());
        await userEvent.click(screen.getByText("Yes, delete permanently"));

        await waitFor(() => expect(screen.getByText("Remove their admin access first.")).toBeInTheDocument());
        expect(rpc).toHaveBeenLastCalledWith("admin_delete_user", { p_user_id: "u1" });
        // A refusal must not read as success.
        expect(onSaved).not.toHaveBeenCalled();
    });
});
