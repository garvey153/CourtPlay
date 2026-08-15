import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminSeedInvitesSheet } from "@/pages/admin/admin-seed-invites-sheet";

const { rpc, sendInvite } = vi.hoisted(() => ({ rpc: vi.fn(), sendInvite: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("@/lib/invite", () => ({ sendInvite }));

const seeded = (over: Record<string, unknown> = {}) => ({
    submitted: 2,
    inserted: 2,
    already_there: 0,
    rejected: [],
    total_invited: 4,
    ...over,
});

const paste = async (text: string) => {
    render(<AdminSeedInvitesSheet onClose={() => {}} onSeeded={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/sara@example.com/), text);
    await userEvent.click(screen.getByText("Add"));
};

/**
 * Adding used to write the rows and stop, leaving the email as a second trip
 * through a different sheet — which produced a beta whose members had never been
 * told. Add now does both, so what these pin is that the send actually happens
 * and that a failure to send is reported rather than swallowed.
 */
describe("Add players to the beta", () => {
    beforeEach(() => {
        rpc.mockReset();
        sendInvite.mockReset();
    });

    it("emails every address it added", async () => {
        rpc.mockResolvedValue({ data: seeded(), error: null });
        sendInvite.mockResolvedValue({ ok: true, message: "" });

        await paste("a@example.com, b@example.com");

        await waitFor(() => expect(screen.getByText(/2 invite emails sent/)).toBeInTheDocument());
        expect(rpc).toHaveBeenCalledWith("admin_seed_invites", { p_emails: ["a@example.com", "b@example.com"] });
        expect(sendInvite).toHaveBeenCalledTimes(2);
        expect(sendInvite).toHaveBeenCalledWith("a@example.com");
        expect(sendInvite).toHaveBeenCalledWith("b@example.com");
    });

    /** The failure the old flow hid: on the list, never told. */
    it("names the addresses whose email did not send", async () => {
        rpc.mockResolvedValue({ data: seeded(), error: null });
        sendInvite
            .mockResolvedValueOnce({ ok: true, message: "" })
            .mockResolvedValueOnce({ ok: false, message: "nope" });

        await paste("a@example.com, b@example.com");

        await waitFor(() => expect(screen.getByText(/didn't send/)).toBeInTheDocument());
        expect(screen.getByText("b@example.com")).toBeInTheDocument();
        expect(screen.queryByText(/invite emails sent\./)).not.toBeInTheDocument();
    });

    it("does not email an address the server called malformed", async () => {
        rpc.mockResolvedValue({ data: seeded({ inserted: 1, rejected: ["not-an-email"] }), error: null });
        sendInvite.mockResolvedValue({ ok: true, message: "" });

        await paste("a@example.com, not-an-email");

        await waitFor(() => expect(screen.getByText(/^Invite email sent/)).toBeInTheDocument());
        expect(sendInvite).toHaveBeenCalledTimes(1);
        expect(sendInvite).toHaveBeenCalledWith("a@example.com");
    });

    it("sends nothing when the list write fails", async () => {
        rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

        await paste("a@example.com");

        await waitFor(() => expect(sendInvite).not.toHaveBeenCalled());
        expect(screen.queryByText(/invite emails sent/)).not.toBeInTheDocument();
    });

    /** Re-pasting someone already listed is how a resend is requested. */
    it("still emails an address that was already on the list", async () => {
        rpc.mockResolvedValue({ data: seeded({ inserted: 0, already_there: 1 }), error: null });
        sendInvite.mockResolvedValue({ ok: true, message: "" });

        await paste("a@example.com");

        await waitFor(() => expect(sendInvite).toHaveBeenCalledWith("a@example.com"));
    });
});
