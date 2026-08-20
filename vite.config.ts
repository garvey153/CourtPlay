import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Short commit SHA of the build, surfaced in the UI (Profile screen) so it's
 * possible to tell from a device which build it is actually running. The service
 * worker can keep a client on an old bundle, which makes "is this fix deployed to
 * me?" otherwise very hard to answer.
 */
function buildId(): string {
    // Vercel exposes the commit SHA at build time.
    const fromCi = process.env.VERCEL_GIT_COMMIT_SHA;
    if (fromCi) return fromCi.slice(0, 7);
    try {
        return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .trim();
    } catch {
        return "dev";
    }
}

export default defineConfig({
    define: {
        __BUILD_ID__: JSON.stringify(buildId()),
    },
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            // We register the worker ourselves (src/lib/register-sw.ts) so we can
            // reload on controllerchange and poll for new builds. The plugin's
            // injected registerSW.js does neither, which left open sessions running
            // stale assets under a newly-activated worker.
            injectRegister: null,
            // Icons are deliberately NOT precached (see globIgnores below), so there's
            // nothing to add here.
            includeAssets: [],
            // The plugin precaches manifest icons on top of globPatterns, which
            // globIgnores does not override — opt out so no icon is precached.
            includeManifestIcons: false,
            manifest: {
                name: "CourtPlay",
                short_name: "CourtPlay",
                description: "Find a tennis sub in Westport in under 10 minutes.",
                // Dark-only app — keep the splash/chrome dark so it doesn't flash white.
                theme_color: "#08180e",
                background_color: "#08180e",
                display: "standalone",
                // Android honours this for installed PWAs and won't rotate at all.
                // iOS Safari has never supported the manifest orientation member, so
                // on iPhone this does nothing — the CSS landscape guard in globals.css
                // is what actually covers the primary platform. Harmless to declare
                // either way, and it means Android gets the better native behaviour.
                orientation: "portrait",
                start_url: "/",
                scope: "/",
                // New PATHS, not ?v= bumps. iOS keys its home-screen icon cache on the
                // URL path and ignores the query, so every ?v= bump was invisible to it
                // and the phone kept reinstalling its cached copy. Since iOS 16.4 Safari
                // prefers these manifest icons over apple-touch-icon for Home Screen web
                // apps, so these are most likely the ones it actually installs.
                // The old paths stay on disk (same bytes) so already-installed clients
                // still referencing them don't 404.
                icons: [
                    {
                        src: "/icons/icon-192-v2.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512-v2.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512-v2.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
                globIgnores: [
                    // OneSignal ships its own service worker — don't let Workbox precache
                    // or manage it; it registers itself under /push/onesignal/.
                    "**/OneSignalSDKWorker.js",
                    // App icons are served from the network, never the precache. Precaching
                    // them means a worker that fails to update keeps serving old artwork
                    // indefinitely, which is exactly what made an icon change look like it
                    // had not deployed. They are not needed offline, and the browser's own
                    // HTTP cache handles them fine.
                    "**/apple-touch-icon*.png",
                    "**/icons/icon-*.png",
                    "**/favicon-32.png",
                    "**/favicon.ico",
                    // Tutorial screenshots — ~300 KB that only the /tutorial route
                    // ever asks for, and only once per player. Precaching them puts
                    // that on every install and every worker update, for everyone,
                    // offline or not. Same reasoning as the icons above.
                    //
                    // They are .jpg today, which globPatterns does not list — so this
                    // is belt and braces. Do not rely on the extension: adding "jpg"
                    // to globPatterns looks like a tidy-up and would silently pull
                    // these (and public/avatars) into the precache.
                    "**/tutorial/*",
                ],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/uheeddmtntnlgrpzfjph\.supabase\.co\/.*/i,
                        handler: "NetworkFirst",
                        options: { cacheName: "supabase-api" },
                    },
                ],
            },
        }),
    ],
    resolve: {
        // ORDER MATTERS. Vite walks these in order, so the specific mapping has
        // to come before "@" — otherwise "@/lib/supabase" matches "@" first and
        // is rewritten to the real client before this is ever considered.
        alias: [
            // Tutorial screenshots only. `npm run capture:tutorial` runs the dev
            // server with DEMO=1 so demo.html can render the REAL pages against
            // fixtures instead of hitting Supabase — the designs show whole
            // screens, and a composition of a page's parts is always thinner
            // than the page.
            //
            // Never reachable from a build: `vite build` is not run with DEMO
            // set, and demo.html is not a build input either way.
            ...(process.env.DEMO === "1"
                ? [{ find: /^@\/lib\/supabase$/, replacement: path.resolve(__dirname, "./src/demo/supabase-mock.ts") }]
                : []),
            { find: "@", replacement: path.resolve(__dirname, "./src") },
        ],
    },
});
