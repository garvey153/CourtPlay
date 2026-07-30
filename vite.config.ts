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
            includeAssets: [
                "apple-touch-icon.png",
                "apple-touch-icon-v2.png",
                "icons/icon-192.png",
                "icons/icon-512.png",
            ],
            manifest: {
                name: "CourtPlay",
                short_name: "CourtPlay",
                description: "Find a tennis sub in Westport in under 10 minutes.",
                // Dark-only app — keep the splash/chrome dark so it doesn't flash white.
                theme_color: "#08180e",
                background_color: "#08180e",
                display: "standalone",
                start_url: "/",
                scope: "/",
                icons: [
                    {
                        src: "/icons/icon-192.png?v=7",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512.png?v=7",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512.png?v=7",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
                // OneSignal ships its own service worker — don't let Workbox precache
                // or manage it; it registers itself under /push/onesignal/.
                globIgnores: ["**/OneSignalSDKWorker.js"],
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
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
