/**
 * True when the app is running as an installed PWA (home-screen app) rather than
 * in a browser tab. Android/desktop expose this via the display-mode media query;
 * iOS Safari uses the legacy `navigator.standalone` flag.
 */
export function isStandalone(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia?.("(display-mode: standalone)").matches === true ||
        (window.navigator as { standalone?: boolean }).standalone === true
    );
}
