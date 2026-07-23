import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"],
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
                        src: "/icons/icon-192.png?v=2",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512.png?v=2",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/icons/icon-512.png?v=2",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
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
