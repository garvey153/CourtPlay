import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@/providers/theme-provider";

// ---------------------------------------------------------------------------
// The theme effect reads darkModeClass and storageKey but listed only [theme]
// as its dependency, so a change to either was ignored until something else
// re-ran the effect. jsdom has no matchMedia, so it is stubbed per-test rather
// than in the shared setup.
// ---------------------------------------------------------------------------

const DARK_QUERY = "(prefers-color-scheme: dark)";

function stubMatchMedia(prefersDark: boolean) {
    const listeners = new Set<() => void>();
    const mql = {
        matches: prefersDark,
        media: DARK_QUERY,
        addEventListener: (_type: string, cb: () => void) => void listeners.add(cb),
        removeEventListener: (_type: string, cb: () => void) => void listeners.delete(cb),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    return {
        /** Flip the OS preference and notify, as the browser would. */
        setPrefersDark(next: boolean) {
            mql.matches = next;
            listeners.forEach((l) => l());
        },
        listenerCount: () => listeners.size,
    };
}

const root = () => document.documentElement;

describe("ThemeProvider", () => {
    beforeEach(() => {
        root().className = "";
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("applies the dark class and stores an explicit dark theme", () => {
        stubMatchMedia(false);
        render(<ThemeProvider defaultTheme="dark">child</ThemeProvider>);

        expect(root().classList.contains("dark-mode")).toBe(true);
        expect(localStorage.getItem("ui-theme")).toBe("dark");
    });

    it("leaves the dark class off for an explicit light theme", () => {
        stubMatchMedia(true);
        render(<ThemeProvider defaultTheme="light">child</ThemeProvider>);

        expect(root().classList.contains("dark-mode")).toBe(false);
        expect(localStorage.getItem("ui-theme")).toBe("light");
    });

    it("follows the OS preference and stores nothing for the system theme", () => {
        stubMatchMedia(true);
        render(<ThemeProvider defaultTheme="system">child</ThemeProvider>);

        expect(root().classList.contains("dark-mode")).toBe(true);
        // "system" is the absence of a choice, not a stored value.
        expect(localStorage.getItem("ui-theme")).toBeNull();
    });

    it("reacts to the OS preference changing while on the system theme", () => {
        const media = stubMatchMedia(true);
        render(<ThemeProvider defaultTheme="system">child</ThemeProvider>);
        expect(root().classList.contains("dark-mode")).toBe(true);

        media.setPrefersDark(false);
        expect(root().classList.contains("dark-mode")).toBe(false);
    });

    it("takes the old class off when darkModeClass changes", () => {
        stubMatchMedia(false);
        const { rerender } = render(
            <ThemeProvider defaultTheme="dark" darkModeClass="dark-mode">
                child
            </ThemeProvider>,
        );
        expect(root().classList.contains("dark-mode")).toBe(true);

        rerender(
            <ThemeProvider defaultTheme="dark" darkModeClass="night">
                child
            </ThemeProvider>,
        );

        expect(root().classList.contains("night")).toBe(true);
        // The whole point: without the cleanup both classes would be applied.
        expect(root().classList.contains("dark-mode")).toBe(false);
    });

    it("writes under the new key when storageKey changes", () => {
        stubMatchMedia(false);
        const { rerender } = render(
            <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
                child
            </ThemeProvider>,
        );
        expect(localStorage.getItem("ui-theme")).toBe("dark");

        rerender(
            <ThemeProvider defaultTheme="dark" storageKey="courtplay-theme">
                child
            </ThemeProvider>,
        );

        expect(localStorage.getItem("courtplay-theme")).toBe("dark");
    });

    it("does not leak a media listener when the effect re-runs", () => {
        const media = stubMatchMedia(false);
        const { rerender, unmount } = render(
            <ThemeProvider defaultTheme="dark" darkModeClass="dark-mode">
                child
            </ThemeProvider>,
        );
        expect(media.listenerCount()).toBe(1);

        // Adding deps means the effect re-runs on prop changes it used to
        // ignore — each run has to tear its own listener down.
        rerender(
            <ThemeProvider defaultTheme="dark" darkModeClass="night">
                child
            </ThemeProvider>,
        );
        expect(media.listenerCount()).toBe(1);

        unmount();
        expect(media.listenerCount()).toBe(0);
    });
});
