import { registerSW } from "virtual:pwa-register";

// How often a long-lived session re-checks for a new build. An installed PWA can
// stay open for days without a navigation, so without this it never notices a
// deploy.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and keeps open sessions on the latest build.
 *
 * The worker is generated with skipWaiting + clientsClaim (registerType
 * "autoUpdate"), so a new worker takes control of already-open pages as soon as it
 * installs. On its own that is the bug we kept hitting: the page keeps running the
 * previous build's HTML and hashed JS/CSS while a newer precache is active, which
 * renders as a stale or half-broken layout until a manual refresh. Reloading when
 * the controller changes lands the page coherently on the new build instead.
 */
export function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    // No controller at startup means the first install is claiming this page rather
    // than a new build replacing an old one — reloading there would bounce every
    // first-time visitor for no reason.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
    });

    registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
            if (!registration) return;

            const check = () => {
                // Offline / transient network failures are expected here.
                registration.update().catch(() => {});
            };

            setInterval(check, UPDATE_INTERVAL_MS);

            // Also check when the app returns to the foreground — the common case
            // for an installed PWA resumed some time after a deploy.
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") check();
            });
        },
    });
}
