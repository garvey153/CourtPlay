import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

afterEach(() => {
    cleanup();
    server.resetHandlers();
});

afterAll(() => server.close());

// jsdom implements no matchMedia. Embla calls it during activation (its
// breakpoint options handler), so the tutorial carousel cannot render without
// this. Reports "no match" for everything, which is the right default: the
// carousel has no responsive options.
if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    })) as typeof window.matchMedia;
}

// Also absent from jsdom. Embla observes slides-in-view, and SubCard counts
// views with one. Individual tests still stub their own where they assert on
// it; this is just so rendering does not throw.
if (!("IntersectionObserver" in window)) {
    class NoopIntersectionObserver {
        observe = () => {};
        disconnect = () => {};
        unobserve = () => {};
        takeRecords = () => [];
        root = null;
        rootMargin = "";
        thresholds = [];
    }
    window.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}

// The third one Embla wants. Same reasoning as the two above.
if (!("ResizeObserver" in window)) {
    class NoopResizeObserver {
        observe = () => {};
        disconnect = () => {};
        unobserve = () => {};
    }
    window.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;
}
