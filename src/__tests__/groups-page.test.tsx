import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Groups } from "@/pages/groups";
import { supabase } from "@/lib/supabase";
import type { GroupSummary } from "@/types/groups";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me-1" }, loading: false }) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ profile: { id: "me-1", is_admin: false }, loading: false }) }));

const rpc = vi.mocked(supabase.rpc);

const group = (over: Partial<GroupSummary> = {}): GroupSummary => ({
    id: "g-1",
    name: "Tuesday Nighters",
    my_role: "member",
    my_status: "active",
    invited_at: "2026-08-03T00:00:00Z",
    member_count: 4,
    preview: [{ id: "u-1", first_name: "Ava", photo_url: null }],
    ...over,
});

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={["/groups"]}>
            <Groups />
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Groups page", () => {
    it("shows the empty state when you have no groups", async () => {
        rpc.mockResolvedValue({ data: [], error: null } as never);
        renderPage();
        expect(await screen.findByText(/No groups yet/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Create a group/i })).toBeInTheDocument();
    });

    it("lists the groups you're in, with their size", async () => {
        rpc.mockResolvedValue({ data: [group()], error: null } as never);
        renderPage();
        expect(await screen.findByText("Tuesday Nighters")).toBeInTheDocument();
        expect(screen.getByText("4 players")).toBeInTheDocument();
    });

    it("singularises a one-player group", async () => {
        rpc.mockResolvedValue({ data: [group({ member_count: 1 })], error: null } as never);
        renderPage();
        expect(await screen.findByText("1 player")).toBeInTheDocument();
    });

    it("surfaces a pending invite in its own section, with Join and Decline", async () => {
        rpc.mockResolvedValue({
            data: [group({ id: "g-2", name: "Sunday Doubles", my_status: "invited" })],
            error: null,
        } as never);
        renderPage();
        expect(await screen.findByText(/Invites \(1\)/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    });

    it("accepting an invite calls respond_to_group_invite with accept=true", async () => {
        const user = userEvent.setup();
        rpc.mockResolvedValue({ data: [group({ my_status: "invited" })], error: null } as never);
        renderPage();
        await screen.findByRole("button", { name: "Join" });

        rpc.mockResolvedValue({ data: { success: true, joined: true }, error: null } as never);
        await user.click(screen.getByRole("button", { name: "Join" }));

        await waitFor(() =>
            expect(rpc).toHaveBeenCalledWith("respond_to_group_invite", { p_group_id: "g-1", p_accept: true }),
        );
    });

    it("declining passes accept=false", async () => {
        const user = userEvent.setup();
        rpc.mockResolvedValue({ data: [group({ my_status: "invited" })], error: null } as never);
        renderPage();
        await screen.findByRole("button", { name: "Decline" });

        rpc.mockResolvedValue({ data: { success: true, joined: false }, error: null } as never);
        await user.click(screen.getByRole("button", { name: "Decline" }));

        await waitFor(() =>
            expect(rpc).toHaveBeenCalledWith("respond_to_group_invite", { p_group_id: "g-1", p_accept: false }),
        );
    });

    it("shows the error state when the load fails, not an empty list", async () => {
        rpc.mockResolvedValue({ data: null, error: { message: "boom" } } as never);
        renderPage();
        // Copy comes from describeLoadError, so assert the retry affordance rather
        // than the wording, which is derived and may change.
        expect(await screen.findByRole("button", { name: /Try again/i })).toBeInTheDocument();
        expect(screen.queryByText(/No groups yet/i)).toBeNull();
    });

    it("surfaces a refusal the RPC reports in its payload rather than as an error", async () => {
        const user = userEvent.setup();
        rpc.mockResolvedValue({ data: [group({ my_status: "invited" })], error: null } as never);
        renderPage();
        await screen.findByRole("button", { name: "Join" });

        // success:false with error copy — the RPCs report refusals this way, and
        // treating it as success is the easy bug here.
        rpc.mockResolvedValue({ data: { success: false, error: "That invite is no longer open" }, error: null } as never);
        await user.click(screen.getByRole("button", { name: "Join" }));

        expect(await screen.findByText("That invite is no longer open")).toBeInTheDocument();
    });
});
