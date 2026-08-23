#!/usr/bin/env node
/**
 * Captures the tutorial screenshots from the dev-only demo entry.
 *
 *   npm run capture:tutorial
 *
 * Boots Vite, screenshots each screen in src/demo/screens.tsx at phone size,
 * writes public/tutorial/*.png, then re-runs the fingerprint test in update
 * mode so the manifest is rewritten by the SAME code that later polices it.
 * Hashing here instead would mean the browser DOM and the jsdom DOM could drift
 * apart, and you would be debugging a false positive forever.
 *
 * Run it twice: the second run must produce an identical manifest. If it does
 * not, something is unpinned — an id, the clock, or an unsettled animation.
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const PORT = 5199;
const OUT = resolve("public/tutorial");
const MAX_FILE = 140 * 1024;
const MAX_TOTAL = 900 * 1024;

// The screen ids, read from the registry rather than duplicated here.
const screensSrc = readFileSync(resolve("src/demo/screens.tsx"), "utf8");
const registry = screensSrc.slice(screensSrc.indexOf("DEMO_SCREENS"));
const ids = [...registry.matchAll(/^\s{4}(\w+):\s*\(\)\s*=>/gm)].map((m) => m[1]);
if (!ids.length) throw new Error("No demo screens found in src/demo/screens.tsx");

// DEMO_NOW lives in a .ts file this .mjs cannot import. Read the literal, and
// fail loudly if it is ever renamed rather than silently capturing live time.
const fixtures = readFileSync(resolve("src/demo/fixtures.ts"), "utf8");
const nowMatch = fixtures.match(/DEMO_NOW = "([^"]+)"/);
if (!nowMatch) throw new Error("Could not read DEMO_NOW from src/demo/fixtures.ts");

// The welcome screen slices this same feed screenshot into bands at these two
// offsets. They were measured off this very render, so this is the one place
// that can tell they have gone stale — jsdom has no layout, so no unit test
// can. A feed card gaining a line would otherwise leave the band boundary
// cutting through a card, visible only during the transition.
const intro = readFileSync(resolve("src/lib/tutorial-intro.ts"), "utf8");
const readOffset = (name) => {
    const m = intro.match(new RegExp(`${name}: (\\d+)`));
    if (!m) throw new Error(`Could not read ${name} from src/lib/tutorial-intro.ts`);
    return Number(m[1]);
};
const EXPECTED = { cardsTop: readOffset("cardsTop"), cardsBottom: readOffset("cardsBottom") };

mkdirSync(OUT, { recursive: true });

// DEMO=1 swaps @/lib/supabase for the fixture client (see vite.config.ts), so
// the demo screens can render the real pages without a network.
const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DEMO: "1" },
});
let browser;

const waitForVite = () =>
    new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error("Vite did not start in 60s")), 60_000);
        vite.stdout.on("data", (d) => {
            if (d.toString().includes("Local:")) {
                clearTimeout(timer);
                res();
            }
        });
        vite.stderr.on("data", (d) => process.stderr.write(d));
    });

try {
    await waitForVite();
    browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark",
    });

    let total = 0;
    const rows = [];

    for (const [i, id] of ids.entries()) {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`http://localhost:${PORT}/demo.html?screen=${id}`, { waitUntil: "networkidle" });
        // Inter comes from the Google Fonts CDN. Without this you commit
        // screenshots rendered in the system fallback and won't notice.
        await page.evaluate(() => document.fonts.ready);
        // Spring sheet transitions are ~400ms.
        await page.waitForTimeout(600);
        if (errors.length) throw new Error(`Demo screen "${id}" errored: ${errors.join("; ")}`);

        if (id === "feed") {
            const actual = await page.evaluate(() => {
                const cards = [...document.querySelectorAll("article, [data-card], li")].filter(
                    (el) => el.getBoundingClientRect().height > 60,
                );
                return {
                    cardsTop: cards[0]?.getBoundingClientRect().top,
                    // The last card's own bottom. The tab bar is hidden in this
                    // capture, so nothing is covering it.
                    cardsBottom: cards.at(-1)?.getBoundingClientRect().bottom,
                };
            });
            for (const [key, want] of Object.entries(EXPECTED)) {
                if (actual[key] !== want) {
                    throw new Error(
                        `The feed moved: tutorial-intro.ts says ${key} is ${want}, this render puts it at ${actual[key]}.\n` +
                            `The welcome screen cuts the step-1 screenshot into bands at those offsets, so a stale one\n` +
                            `slices through a card. Update STEP1 in src/lib/tutorial-intro.ts and re-run.`,
                    );
                }
            }
        }

        // JPEG, not PNG: these are full-screen shots containing avatar photos
        // over a dark UI, where PNG lands around 150 KB each. A new player
        // downloads all of them on cellular immediately after signing up.
        const file = resolve(OUT, `0${i + 1}-${id}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 82 });
        await page.close();

        const bytes = statSync(file).size;
        total += bytes;
        rows.push([id, `${(bytes / 1024).toFixed(0)} KB`, bytes > MAX_FILE ? "OVER" : ""]);
    }

    console.log("\nCaptured:");
    for (const [id, size, flag] of rows) console.log(`  ${id.padEnd(12)} ${size.padStart(8)} ${flag}`);
    console.log(`  ${"total".padEnd(12)} ${`${(total / 1024).toFixed(0)} KB`.padStart(8)}\n`);

    const over = rows.filter((r) => r[2]);
    if (over.length || total > MAX_TOTAL) {
        // These images are deliberately not precached, but they are still bytes
        // a new player downloads on cellular right after signing up.
        throw new Error(
            `Screenshot budget exceeded (${MAX_FILE / 1024} KB per file, ${MAX_TOTAL / 1024} KB total). ` +
                `Over: ${over.map((r) => r[0]).join(", ") || "total only"}`,
        );
    }

    console.log("Updating the fingerprint manifest…");
    execSync("npx vitest run src/__tests__/tutorial-screens.test.tsx", {
        stdio: "inherit",
        env: { ...process.env, UPDATE_TUTORIAL_MANIFEST: "1" },
    });
    console.log("\nDone. Review the images before committing.");
} finally {
    await browser?.close();
    vite.kill();
}
