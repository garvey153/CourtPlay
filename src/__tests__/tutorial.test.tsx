import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { TutorialCarousel } from "@/components/app/tutorial-carousel";
import { Tutorial } from "@/pages/tutorial";
import { TUTORIAL_SLIDES } from "@/lib/tutorial-slides";
import type { UserProfile } from "@/providers/profile-provider";

const { update, eq, useAuthMock, profileMock, setProfile } = vi.hoisted(() => ({
    update: vi.fn(),
    eq: vi.fn(),
    useAuthMock: vi.fn(),
    profileMock: vi.fn(),
    setProfile: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
    supabase: { from: () => ({ update: (...a: unknown[]) => (update(...a), { eq }) }) },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: useAuthMock }));
vi.mock("@/providers/profile-provider", async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    useProfile: profileMock,
}));

function Probe() {
    return <span data-testid="path">{useLocation().pathname}</span>;
}

const renderPage = (path = "/tutorial") =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/tutorial" element={<Tutorial />} />
                <Route path="/feed" element={<span>the feed</span>} />
                <Route path="/post/:id" element={<span>the post</span>} />
                <Route path="/profile/edit" element={<span>manage</span>} />
            </Routes>
            <Probe />
        </MemoryRouter>,
    );

const profile = (over: Partial<UserProfile> = {}) =>
    ({ id: "u1", tutorial_seen_at: null, ...over }) as UserProfile;

/**
 * The tutorial sits between onboarding and wherever the player was actually
 * going. The deep-link cases are the ones worth guarding: `cs_auth_redirect`
 * holds a shared /post/:id opened before signing in, and inserting a screen in
 * front of it is exactly where that gets dropped.
 */
describe("tutorial", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        useAuthMock.mockReturnValue({ user: { id: "u1" }, loading: false });
        profileMock.mockReturnValue({ profile: profile(), setProfile, loading: false });
    });

    describe("carousel", () => {
        it("shows one dot per slide", () => {
            render(<TutorialCarousel slides={TUTORIAL_SLIDES} onSkip={vi.fn()} onDone={vi.fn()} />);
            // Dots are mapped from the slide list, not from Embla's snap list —
            // which is empty in jsdom, and would make this untestable.
            expect(screen.getAllByRole("button").filter((b) => b.querySelector("span.rounded-full"))).toHaveLength(
                TUTORIAL_SLIDES.length,
            );
        });

        it("offers a way to skip", async () => {
            const onSkip = vi.fn();
            render(<TutorialCarousel slides={TUTORIAL_SLIDES} onSkip={onSkip} onDone={vi.fn()} />);
            await userEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
            expect(onSkip).toHaveBeenCalled();
        });

        it("turns the skip into the finish on the last slide", async () => {
            const onDone = vi.fn();
            render(<TutorialCarousel slides={TUTORIAL_SLIDES} onSkip={vi.fn()} onDone={onDone} />);
            expect(screen.queryByRole("button", { name: /Go to CourtPlay/ })).not.toBeInTheDocument();

            // One slide means the first slide IS the last one — the design puts
            // the finish in the same slot the skip occupies.
            render(<TutorialCarousel slides={[TUTORIAL_SLIDES[0]]} onSkip={vi.fn()} onDone={onDone} />);
            await userEvent.click(screen.getByRole("button", { name: /Go to CourtPlay/ }));
            expect(onDone).toHaveBeenCalled();
        });

        it("gives every image real alt text", () => {
            render(<TutorialCarousel slides={TUTORIAL_SLIDES} onSkip={vi.fn()} onDone={vi.fn()} />);
            for (const img of screen.getAllByRole("img")) {
                expect(img.getAttribute("alt")).toBeTruthy();
            }
        });
    });

    describe("where Done goes", () => {
        it("honours a deep link, and clears it", async () => {
            sessionStorage.setItem("cs_auth_redirect", "/post/2b8f1c9e-0000-4000-8000-000000000000");
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
            await waitFor(() => expect(screen.getByTestId("path").textContent).toMatch(/^\/post\//));
            expect(sessionStorage.getItem("cs_auth_redirect")).toBeNull();
        });

        it("falls back to the feed when the stored value is not a post link", async () => {
            sessionStorage.setItem("cs_auth_redirect", "https://evil.example.com");
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
            await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/feed"));
        });

        it("goes to the feed when there is no deep link", async () => {
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
            await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/feed"));
        });

        it("records that it was seen", async () => {
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
            await waitFor(() => expect(update).toHaveBeenCalled());
            expect(update.mock.calls[0][0]).toHaveProperty("tutorial_seen_at");
        });
    });

    describe("showing it again", () => {
        /** Reloading or backing into /tutorial must not trap you in it. */
        it("redirects straight through once seen", async () => {
            profileMock.mockReturnValue({
                profile: profile({ tutorial_seen_at: "2026-08-01T00:00:00Z" }),
                setProfile,
                loading: false,
            });
            renderPage();
            await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/feed"));
            expect(screen.queryByRole("button", { name: "Skip tutorial" })).not.toBeInTheDocument();
        });

        it("still plays when replayed on purpose", () => {
            profileMock.mockReturnValue({
                profile: profile({ tutorial_seen_at: "2026-08-01T00:00:00Z" }),
                setProfile,
                loading: false,
            });
            renderPage("/tutorial?replay=1");
            expect(screen.getByRole("button", { name: "Skip tutorial" })).toBeInTheDocument();
        });

        it("returns to Manage after a replay, not the feed", async () => {
            profileMock.mockReturnValue({ profile: profile(), setProfile, loading: false });
            renderPage("/tutorial?replay=1");
            await userEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
            await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/profile/edit"));
        });
    });
});
