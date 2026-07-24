import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    // This config doesn't inherit vite.config.ts, so build-time constants defined
    // there have to be repeated or components referencing them throw at test time.
    define: {
        __BUILD_ID__: JSON.stringify("test"),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
        exclude: ["src/stories/**"],
        coverage: {
            provider: "v8",
            exclude: ["src/test/**", "src/components/ui/**", "src/stories/**"],
        },
    },
});
