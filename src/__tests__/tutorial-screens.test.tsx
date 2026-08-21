import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, act } from "@testing-library/react";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DemoProviders } from "@/demo/demo-providers";
import { DEMO_SCREENS } from "@/demo/screens";
import { DEMO_NOW } from "@/demo/fixtures";
import { fingerprintElement, serializeElement } from "@/test/fingerprint";

// No session, exactly as the capture browser sees it — a fresh context has none.
// The two engines must resolve auth the same way or the fingerprint would
// police a tree the screenshot never showed.
// The same fixture client the browser gets through the DEMO=1 Vite alias. Both
// engines must render the same tree, or the fingerprint would police something
// the screenshot never showed.
vi.mock("@/lib/supabase", async () => await import("@/demo/supabase-mock"));

// jsdom has no IntersectionObserver; SubCard uses one to count views. The
// browser has the real thing, and neither affects the rendered tree.
class NoopIntersectionObserver {
    observe = () => {};
    disconnect = () => {};
    unobserve = () => {};
}
vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);

const MANIFEST = resolve(process.cwd(), "src/demo/screens.manifest.json");
const UPDATING = !!process.env.UPDATE_TUTORIAL_MANIFEST;

interface Manifest {
    note: string;
    screens: Record<string, { hash: string; image: string }>;
}

const readManifest = (): Manifest =>
    existsSync(MANIFEST)
        ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest)
        : { note: "", screens: {} };

/**
 * The staleness flag behind the tutorial screenshots.
 *
 * public/tutorial/*.png are captured from these same demo screens. When a UI
 * change moves a screen's structure, the committed image no longer shows what
 * the app looks like — and nothing else in the suite would notice, because the
 * images are just files.
 *
 * So: render each screen, hash its structure, compare to the committed
 * manifest. Run with UPDATE_TUTORIAL_MANIFEST=1 to rewrite it — which is what
 * `npm run capture:tutorial` does after taking new screenshots, so the hashing
 * happens in exactly one place rather than once here and once in the browser.
 */
/**
 * Flush until the tree stops moving.
 *
 * A single `act` round is not enough: the screens that render a real page wait
 * on `getSession()` and THEN fetch their rows, so one flush leaves them showing
 * a loading or empty state. That is not a slow test — it is a blind one. It
 * shipped that way: `activity` fingerprinted its "It's your serve" empty state
 * while the screenshot beside it showed two cards, so no change to those cards
 * could ever have failed this test.
 *
 * Settling on "two consecutive rounds serialize the same" handles a chain of
 * any length without hard-coding how long it is.
 */
const SETTLE_ROUNDS = 20;

async function settle(container: Element) {
    let previous = "";
    for (let i = 0; i < SETTLE_ROUNDS; i++) {
        await act(async () => {});
        const current = serializeElement(container);
        if (current === previous) return;
        previous = current;
    }
    throw new Error(`Demo screen never settled after ${SETTLE_ROUNDS} flushes.`);
}

describe("tutorial screenshots are current", () => {
    beforeAll(() => {
        vi.setSystemTime(new Date(DEMO_NOW));
    });

    const hashes: Record<string, string> = {};

    for (const id of Object.keys(DEMO_SCREENS)) {
        it(`fingerprints "${id}"`, async () => {
            const { container } = render(<DemoProviders screen={id}>{DEMO_SCREENS[id]()}</DemoProviders>);
            await settle(container);
            hashes[id] = fingerprintElement(container);

            if (UPDATING) return;

            const expected = readManifest().screens[id]?.hash;
            expect(
                hashes[id],
                `\n\nTutorial screenshot is stale: "${id}".\n\n` +
                    `The demo screen's rendered structure changed, so its committed\n` +
                    `image no longer shows what the app looks like.\n\n` +
                    `Re-capture and commit:  npm run capture:tutorial\n\n` +
                    `Review the new images before committing — this test only knows\n` +
                    `the structure changed, not whether the change is an improvement.\n`,
            ).toBe(expected);
        });
    }

    /** An added or removed screen would otherwise pass silently. */
    it("has a manifest entry for every screen, and no extras", () => {
        if (UPDATING) return;
        expect(Object.keys(readManifest().screens).sort()).toEqual(Object.keys(DEMO_SCREENS).sort());
    });

    it("has the image file each manifest entry names", () => {
        if (UPDATING) return;
        const { screens } = readManifest();
        for (const [id, entry] of Object.entries(screens)) {
            expect(existsSync(resolve(process.cwd(), "public", entry.image)), `missing image for "${id}"`).toBe(true);
        }
    });

    it("writes the manifest when asked", () => {
        if (!UPDATING) return;
        const previous = readManifest().screens;
        const screens: Manifest["screens"] = {};
        for (const [i, id] of Object.keys(DEMO_SCREENS).entries()) {
            const image = `tutorial/0${i + 1}-${id}.jpg`;
            if (previous[id]?.hash !== hashes[id]) {
                console.log(`  ${id}: ${previous[id]?.hash ?? "(new)"} → ${hashes[id]}`);
            }
            screens[id] = { hash: hashes[id], image };
        }
        writeFileSync(
            MANIFEST,
            JSON.stringify(
                { note: "Generated by `npm run capture:tutorial`. Do not edit by hand.", screens },
                null,
                4,
            ) + "\n",
        );
    });
});
