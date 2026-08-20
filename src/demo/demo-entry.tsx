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

// Silence the first-run banners. The feed's notification stack would otherwise
// put the welcome card, the install prompt and a claim notice over the posts —
// none of which the tutorial is about, and all of which vary with storage state
// rather than with the UI.
for (const key of ["cs_welcome_done", "cs_ios_prompt_dismissed"]) localStorage.setItem(key, "1");
localStorage.setItem("courtsub_push_prompt_dismissed", "true");

// Screenshot-only styling. The Beta pill is a moment in time, not a feature
// worth teaching, so it is hidden here rather than in the app.
//
// The app's own bg-primary STAYS. An earlier version blacked it out to hide
// bands at the top and bottom of the tutorial page, which was the wrong end of
// the problem: those bands are the tutorial's own body showing through, and
// blacking out bg-primary took the app's background out of the screenshots too.
const demoStyle = document.createElement("style");
demoStyle.textContent = `
    [data-beta-tag] { display: none; }
`;
document.head.appendChild(demoStyle);

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
            <DemoProviders screen={id}>{screen()}</DemoProviders>
        </ThemeProvider>,
    );
}
