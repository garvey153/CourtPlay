import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

/** A token shaped like the real thing — gen_random_uuid() in the invites table. */
const TOKEN = "9f2c4a1b-7d3e-4c58-b0a1-41ae08bb96d1";

/** Surfaces the current path so a redirect can be asserted, not just inferred. */
function PathProbe() {
    return <span data-testid="path">{useLocation().pathname}</span>;
}

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithOAuth: vi.fn() },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        rpc,
    },
}));

/**
 * During the closed beta the sign-up form is offered only to someone who arrived
 * from an invite email. Everyone else gets sign-in and no hint that sign-up
 * exists — no toggle, no "don't have an account?", and /signup in the address bar
 * becomes /signin.
 *
 * The marker is `?invite=<token>` on the invite link, with `?email=<address>`
 * still honoured for invites sent before the token existed. Neither is a
 * secret: the trigger on public.users is the real gate, and these tests pin
 * VISIBILITY, not access. Nothing here should ever be read as proof that
 * sign-up is unreachable.
 */
const renderAuth = async (opts: { inviteOnly: boolean; path: string }) => {
    vi.resetModules();
    localStorage.clear();
    vi.stubEnv("VITE_INVITE_ONLY", opts.inviteOnly ? "true" : "");
    const { AuthScreen } = await import("@/pages/auth");
    const result = render(
        <MemoryRouter initialEntries={[opts.path]}>
            <Routes>
                <Route path="/signin" element={<AuthScreen />} />
                <Route path="/signup" element={<AuthScreen />} />
            </Routes>
            <PathProbe />
        </MemoryRouter>,
    );
    return result;
};

/**
 * Every control on the screen that says "Sign up" — the toggle tab, the submit
 * button and the footer switch. Asserting on all of them together is the point:
 * the requirement is that nothing anywhere offers sign-up, not that one
 * particular tab is hidden.
 */
const signUpControls = () => screen.queryAllByRole("button", { name: "Sign up" });

describe("auth screen — closed beta", () => {
    describe("copy", () => {
        it("tells a landing-page visitor why there is no sign up", async () => {
            await renderAuth({ inviteOnly: true, path: "/signin" });
            expect(screen.getByText(/invite only while we're in beta/i)).toBeInTheDocument();
            // The address is the bit that actually goes wrong — the gate keys on
            // the invited email, so signing in with another one is what sends
            // people to /invite-only.
            expect(screen.getByText(/email address your invite was sent to/i)).toBeInTheDocument();
        });

        it("keeps the ordinary sign-in copy when the beta is off", async () => {
            await renderAuth({ inviteOnly: false, path: "/signin" });
            expect(screen.getByText(/never miss game day/i)).toBeInTheDocument();
            expect(screen.queryByText(/invite only while we're in beta/i)).not.toBeInTheDocument();
        });

        /** Coming from an invite, sign up is the point — not an explanation of the beta. */
        it("does not show the beta explainer to someone who arrived from an invite", async () => {
            await renderAuth({ inviteOnly: true, path: "/signup?email=jane%40example.com" });
            expect(screen.queryByText(/invite only while we're in beta/i)).not.toBeInTheDocument();
        });
    });

    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        // Unset by default: a test that cares about the round trip says so.
        rpc.mockReset();
        rpc.mockResolvedValue({ data: null, error: null });
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        localStorage.clear();
    });

    describe("when the beta is off", () => {
        it("still offers sign up at /signup", async () => {
            await renderAuth({ inviteOnly: false, path: "/signup" });
            expect(screen.getByText("Create your account")).toBeInTheDocument();
            expect(signUpControls().length).toBeGreaterThan(0);
        });

        it("still offers the switch from /signin", async () => {
            await renderAuth({ inviteOnly: false, path: "/signin" });
            expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
            expect(signUpControls().length).toBeGreaterThan(0);
        });
    });

    describe("when the beta is on and they did NOT come from an invite", () => {
        it("shows sign in only, with no way to reach sign up", async () => {
            await renderAuth({ inviteOnly: true, path: "/signin" });
            expect(screen.getByText("Ready to play?")).toBeInTheDocument();
            expect(signUpControls()).toHaveLength(0);
            expect(screen.queryByText("Don't have an account?")).not.toBeInTheDocument();
        });

        it("turns a bare /signup into sign in", async () => {
            await renderAuth({ inviteOnly: true, path: "/signup" });
            expect(screen.getByText("Ready to play?")).toBeInTheDocument();
            expect(screen.queryByText("Create your account")).not.toBeInTheDocument();
            expect(signUpControls()).toHaveLength(0);
            // The address bar should say so too, not just the rendered screen.
            expect(screen.getByTestId("path")).toHaveTextContent("/signin");
        });
    });

    describe("when the beta is on and they came from the invite email", () => {
        it("offers sign up and prefills the invited address", async () => {
            await renderAuth({ inviteOnly: true, path: "/signup?email=jane%40example.com" });
            expect(screen.getByText("Create your account")).toBeInTheDocument();
            expect(screen.getByTestId("path")).toHaveTextContent("/signup");
            expect(screen.getByLabelText(/Email/)).toHaveValue("jane@example.com");
        });

        /**
         * The link the invite email actually carries now. The address is not in
         * it — that is the whole point, since a clickable account-creation link
         * containing the recipient's own email reads as phishing to a spam
         * filter — so it has to be fetched before the field can be filled.
         */
        it("offers sign up and prefills from an invite token", async () => {
            rpc.mockResolvedValue({ data: "jane@example.com", error: null });
            await renderAuth({ inviteOnly: true, path: `/signup?invite=${TOKEN}` });

            expect(screen.getByText("Create your account")).toBeInTheDocument();
            expect(rpc).toHaveBeenCalledWith("invite_email_for_token", { p_token: TOKEN });
            await waitFor(() => expect(screen.getByLabelText(/Email/)).toHaveValue("jane@example.com"));
        });

        /**
         * Sign-up is on screen from the first paint, before the round trip
         * finishes. Waiting for it would flash a sign-in-only screen at an
         * invited player — on a slow connection, for long enough to read.
         */
        it("offers sign up immediately, without waiting for the address", async () => {
            let release: (value: { data: string | null; error: null }) => void = () => {};
            rpc.mockReturnValue(new Promise((resolve) => (release = resolve)));

            await renderAuth({ inviteOnly: true, path: `/signup?invite=${TOKEN}` });
            expect(screen.getByText("Create your account")).toBeInTheDocument();
            expect(screen.getByTestId("path")).toHaveTextContent("/signup");

            release({ data: "jane@example.com", error: null });
        });

        /**
         * A stale, accepted or mistyped token resolves to nothing. Sign-up stays
         * available and they type the address themselves — which is what the
         * email tells them to use anyway. Turning them away here would strand
         * someone genuinely invited.
         */
        it("still offers sign up when the token resolves to nothing", async () => {
            rpc.mockResolvedValue({ data: null, error: null });
            await renderAuth({ inviteOnly: true, path: `/signup?invite=${TOKEN}` });

            expect(screen.getByText("Create your account")).toBeInTheDocument();
            expect(screen.getByLabelText(/Email/)).toHaveValue("");
        });

        /** A late answer must not overwrite something they have started typing. */
        it("does not clobber an address typed before the token resolved", async () => {
            let release: (value: { data: string | null; error: null }) => void = () => {};
            rpc.mockReturnValue(new Promise((resolve) => (release = resolve)));
            await renderAuth({ inviteOnly: true, path: `/signup?invite=${TOKEN}` });

            const field = screen.getByLabelText(/Email/);
            await userEvent.type(field, "typed@example.com");

            release({ data: "jane@example.com", error: null });
            await waitFor(() => expect(rpc).toHaveBeenCalled());
            expect(field).toHaveValue("typed@example.com");
        });

        /**
         * The marker has to outlive the link. Someone who opens the invite, gets
         * bounced to Google and back, or simply reloads, must not land on a
         * sign-in-only screen with no account to sign in to.
         */
        it("keeps offering sign up on a later visit without the parameter", async () => {
            const first = await renderAuth({ inviteOnly: true, path: "/signup?email=jane%40example.com" });
            expect(signUpControls().length).toBeGreaterThan(0);
            first.unmount();

            // Same device, fresh navigation, no query string.
            const { AuthScreen } = await import("@/pages/auth");
            render(
                <MemoryRouter initialEntries={["/signup"]}>
                    <Routes>
                        <Route path="/signup" element={<AuthScreen />} />
                        <Route path="/signin" element={<AuthScreen />} />
                    </Routes>
                </MemoryRouter>,
            );
            expect(screen.getByText("Create your account")).toBeInTheDocument();
        });
    });
});
