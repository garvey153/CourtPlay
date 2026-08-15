import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

/** Surfaces the current path so a redirect can be asserted, not just inferred. */
function PathProbe() {
    return <span data-testid="path">{useLocation().pathname}</span>;
}

vi.mock("@/lib/supabase", () => ({
    supabase: {
        auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithOAuth: vi.fn() },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        rpc: vi.fn(),
    },
}));

/**
 * During the closed beta the sign-up form is offered only to someone who arrived
 * from an invite email. Everyone else gets sign-in and no hint that sign-up
 * exists — no toggle, no "don't have an account?", and /signup in the address bar
 * becomes /signin.
 *
 * The marker is `?email=` on the invite link. It is deliberately guessable: the
 * trigger on public.users is the real gate, and these tests pin VISIBILITY, not
 * access. Nothing here should ever be read as proof that sign-up is unreachable.
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
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
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
