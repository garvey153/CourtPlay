import { isStandalone } from "@/utils/is-standalone";

/**
 * Forces iOS to re-evaluate the viewport shortly after launch.
 *
 * In the installed PWA the first paint can be laid out against a viewport that
 * hasn't applied `viewport-fit=cover` yet, so it is ~40px shorter than the screen.
 * Everything measured from it lands high — the `h-dvh` app shell, and with it the
 * bottom nav, which sits above the screen edge until the user swipes. The swipe is
 * what makes Safari re-measure; this does the same thing without the gesture.
 *
 * Re-writing the viewport meta makes Safari re-parse and re-apply it (including
 * viewport-fit), and the scroll nudge mimics the gesture that was working. Both are
 * cheap and invisible, so we do both rather than bet on one.
 *
 * Standalone only — this doesn't reproduce in a normal Safari tab, and there's no
 * reason to touch the viewport there.
 */
export function settleViewport() {
    if (typeof document === "undefined" || !isStandalone()) return;

    const meta = document.querySelector('meta[name="viewport"]');

    const settle = () => {
        // Re-apply the viewport meta: toggling the attribute is what makes WebKit
        // re-parse it. Restore the original on the next frame so the declared
        // behaviour (maximum-scale, viewport-fit) is unchanged.
        if (meta) {
            const original = meta.getAttribute("content") ?? "";
            meta.setAttribute("content", `${original}, user-scalable=no`);
            requestAnimationFrame(() => meta.setAttribute("content", original));
        }

        // Nudge the scroll container by a pixel and back — the programmatic
        // equivalent of the swipe that currently fixes it.
        const main = document.querySelector("main");
        if (main && main.scrollHeight > main.clientHeight) {
            main.scrollTop = 1;
            main.scrollTop = 0;
        }
    };

    // After the first paint, and once more after layout has had a beat — the
    // viewport can settle late enough that a single pass misses it.
    requestAnimationFrame(() => requestAnimationFrame(settle));
    setTimeout(settle, 250);

    // Rotating changes the insets, so re-settle then too.
    window.addEventListener("orientationchange", () => setTimeout(settle, 100));
}
