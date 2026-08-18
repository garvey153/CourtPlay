import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/providers/theme-provider";
import { DemoProviders } from "./demo-providers";
import { DEMO_SCREENS } from "./screens";
import { DEMO_NOW } from "./fixtures";
import "@/styles/globals.css";

/**
 * Dev-only entry behind `demo.html`, used by scripts/capture-tutorial.mjs.
 *
 * Never part of a production build: vite.config.ts sets no rollupOptions.input,
 * so `vite build` builds index.html and nothing else. That is deliberately
 * stronger than an import.meta.env.DEV guard, which a refactor can defeat.
 */

// Freeze the clock BEFORE the first render — sub-card renders time-relative
// labels, and a live clock would make every capture disagree with the last.
const frozen = Date.parse(DEMO_NOW);
const RealDate = Date;
class FrozenDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
        // @ts-expect-error — forwarding a variadic Date constructor
        super(...(args.length ? args : [frozen]));
    }
    static now() {
        return frozen;
    }
}
globalThis.Date = FrozenDate as DateConstructor;

const id = new URLSearchParams(location.search).get("screen") ?? "";
const screen = DEMO_SCREENS[id];

const root = createRoot(document.getElementById("root")!);

if (!screen) {
    // Fail loudly. A typo must not quietly produce a blank screenshot that then
    // gets committed and shipped.
    root.render(
        <pre style={{ color: "#fff", padding: 24, fontFamily: "monospace" }}>
            {`Unknown demo screen: "${id}"\n\nKnown: ${Object.keys(DEMO_SCREENS).join(", ")}`}
        </pre>,
    );
    throw new Error(`Unknown demo screen: "${id}"`);
} else {
    root.render(
        <ThemeProvider defaultTheme="dark">
            <DemoProviders>{screen()}</DemoProviders>
        </ThemeProvider>,
    );
}
