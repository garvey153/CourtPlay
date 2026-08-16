import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { InviteOnly } from "@/pages/invite-only";
import { AuthCallback } from "@/pages/auth-callback";
import { supabase } from "@/lib/supabase";

const { rpc, getSession, getUser, signOut, navigate } = vi.hoisted(() => ({
    rpc: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn().mockResolvedValue({}),
    navigate: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        rpc,
        auth: { getSession, getUser, signOut },
        from: vi.fn(() => ({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        })),
    },
}));

vi.mock("react-router", async () => {
    const actual = await vi.importActual<typeof import("react-router")>("react-router");
    return { ...actual, useNavigate: () => navigate };
});

const session = (email: string) => ({ data: { session: { user: { id: "u1", email } } } });

/**
 * The gate is the trigger on public.users. This screen exists so nobody fills in
 * three steps of onboarding to find that out — and so the one genuinely
 * confusing failure (invited at one address, signed in with another) is legible.
 */
describe("invite-only screen", () => {
    beforeEach(() => {
        rpc.mockReset();
        getUser.mockReset();
        signOut.mockClear();
        navigate.mockReset();
        getSession.mockReset();
    });

    it("names the address that was checked", async () => {
        getUser.mockResolvedValue({ data: { user: { email: "nobody@example.com" } } });
        render(
            <MemoryRouter>
                <InviteOnly />
            </MemoryRouter>,
        );
        expect(await screen.findByText("nobody@example.com")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "CourtPlay is invite only, for now." })).toBeInTheDocument();
    });

    it("signs the session out on arrival", async () => {
        getUser.mockResolvedValue({ data: { user: { email: "nobody@example.com" } } });
        render(
            <MemoryRouter>
                <InviteOnly />
            </MemoryRouter>,
        );
        // Leaving someone signed in but unable to do anything is worse than
        // signing them out, and a stale session loops them back here forever.
        await waitFor(() => expect(signOut).toHaveBeenCalled());
    });

    it("offers a way to try the other address", async () => {
        getUser.mockResolvedValue({ data: { user: { email: "nobody@example.com" } } });
        render(
            <MemoryRouter>
                <InviteOnly />
            </MemoryRouter>,
        );
        expect(await screen.findByRole("link", { name: "Try another account" })).toHaveAttribute("href", "/signin");
    });
});

describe("auth-callback invite check", () => {
    beforeEach(() => {
        rpc.mockReset();
        navigate.mockReset();
        getSession.mockReset();
    });

    const renderCallback = () =>
        render(
            <MemoryRouter>
                <AuthCallback />
            </MemoryRouter>,
        );

    it("sends an uninvited new account to the invite-only screen", async () => {
        getSession.mockResolvedValue(session("nobody@example.com"));
        rpc.mockResolvedValue({ data: false, error: null });
        renderCallback();
        await waitFor(() =>
            expect(navigate).toHaveBeenCalledWith("/invite-only", {
                replace: true,
                state: { email: "nobody@example.com" },
            }),
        );
    });

    it("sends an invited new account to onboarding", async () => {
        getSession.mockResolvedValue(session("invited@example.com"));
        rpc.mockResolvedValue({ data: true, error: null });
        renderCallback();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/onboarding", { replace: true }));
    });

    /**
     * The server refuses the profile write regardless, so a failed check must
     * not turn an invited player away. Failing closed here would convert a
     * network blip into a lockout for no gain.
     */
    it("fails OPEN when the check errors", async () => {
        getSession.mockResolvedValue(session("invited@example.com"));
        rpc.mockResolvedValue({ data: null, error: { message: "network" } });
        renderCallback();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/onboarding", { replace: true }));
        expect(navigate).not.toHaveBeenCalledWith("/invite-only", expect.anything());
    });

    it("never asks for an account that already has a profile", async () => {
        getSession.mockResolvedValue(session("member@example.com"));
        vi.mocked(supabase.from).mockReturnValueOnce({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "u1" } }) }) }),
        } as never);
        renderCallback();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/feed", { replace: true }));
        expect(rpc).not.toHaveBeenCalled();
    });

    /**
     * Figma 662:4309. The screen went from a centred card with a mail icon to a
     * left-aligned page with a 36px headline, so the things worth pinning are the
     * ones a future tidy-up would quietly undo.
     */
    describe("design (662:4309)", () => {
        it("uses the Display md headline, not the old centred card", async () => {
            getUser.mockResolvedValue({ data: { user: { email: "nobody@example.com" } } });
            const { container } = render(
                <MemoryRouter>
                    <InviteOnly />
                </MemoryRouter>,
            );
            const heading = await screen.findByRole("heading");
            expect(heading.className).toContain("text-display-md");
            // The mail icon and the centred text both went.
            expect(container.querySelector("svg")).toBeNull();
            expect(container.querySelector(".text-center")).not.toBe(heading);
        });

        it("offers both ways out, with Try another account as the primary", async () => {
            getUser.mockResolvedValue({ data: { user: { email: "nobody@example.com" } } });
            render(
                <MemoryRouter>
                    <InviteOnly />
                </MemoryRouter>,
            );
            const primary = screen.getByRole("link", { name: "Try another account" });
            expect(primary).toHaveAttribute("href", "/signin");
            expect(primary.className).toContain("bg-brand-500");

            const secondary = screen.getByRole("link", { name: "Back to CourtPlay" });
            expect(secondary).toHaveAttribute("href", "/");
            expect(secondary.className).not.toContain("bg-brand-500");
        });

        /** With no session to read, the sentence still has to finish. */
        it("reads sensibly when the address is unknown", async () => {
            getUser.mockResolvedValue({ data: { user: null } });
            render(
                <MemoryRouter>
                    <InviteOnly />
                </MemoryRouter>,
            );
            await waitFor(() => expect(document.body.textContent).toContain("that account."));
        });
    });
});
