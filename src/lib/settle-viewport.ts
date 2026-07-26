import { isStandalone } from "@/utils/is-standalone";

/**
 * Forces iOS to re-evaluate the viewport.
 *
 * In the installed PWA the layout can be measured against a viewport that hasn't
 * applied `viewport-fit=cover` yet, so it is ~40px shorter than the screen and the
 * `h-dvh` shell (and its bottom nav) sits high until a gesture forces a re-measure.
 * Re-writing the viewport meta makes WebKit re-parse and re-apply it (viewport-fit
 * included); the scroll nudge mimics the gesture. Both are cheap and invisible.
 *
 * Standalone only — this doesn't reproduce in a normal Safari tab.
 */
function settleNow() {
    if (typeof document === "undefined" || !isStandalone()) return;

    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
        const original = meta.getAttribute("content") ?? "";
        meta.setAttribute("content", `${original}, user-scalable=no`);
        requestAnimationFrame(() => meta.setAttribute("content", original));
    }

    const main = document.querySelector("main");
    if (main && main.scrollHeight > main.clientHeight) {
        main.scrollTop = 1;
        main.scrollTop = 0;
    }
}

/**
 * Run a settle pass after the next paint, and once more after a short delay since
 * the viewport can settle late enough that a single pass misses it. Safe to call
 * repeatedly — call it whenever a screen that anchors to the viewport bottom (the
 * app shell / bottom nav) mounts, not only at first load. A client-side login
 * navigates into the shell without a new document load, so the initial pass from
 * main.tsx doesn't cover it.
 */
export function scheduleSettle() {
    if (typeof document === "undefined" || !isStandalone()) return;
    requestAnimationFrame(() => requestAnimationFrame(settleNow));
    setTimeout(settleNow, 250);
}

let listenersBound = false;

/**
 * One-time startup entry (main.tsx): run the initial settle passes and bind the
 * orientation listener (rotating changes the insets).
 */
export function settleViewport() {
    if (typeof document === "undefined" || !isStandalone()) return;
    scheduleSettle();
    if (!listenersBound) {
        listenersBound = true;
        window.addEventListener("orientationchange", () => setTimeout(settleNow, 100));
    }
}
