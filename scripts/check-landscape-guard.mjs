/**
 * Does the landscape guard cover the app exactly when it should?
 *
 * The guard is pure CSS — a media query and one `:has` rule — so nothing in the
 * jsdom test suite can see it: jsdom has no layout and evaluates no media
 * queries. This drives a real browser through the viewports that matter instead.
 *
 * The case that put this here is the first one. WebKit derives `orientation`
 * from the visual viewport, so an open keyboard on a small phone in PORTRAIT
 * leaves a box wider than it is tall and iOS starts reporting landscape — the
 * overlay then covered the app mid-signup. Every row below is a real device
 * state; the expectations are the point, not the mechanism.
 *
 *   npm run build && npm run check:landscape
 */
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 4188);
const URL = `http://localhost:${PORT}/`;

const CASES = [
    // width, height, coarse pointer, expected display
    { name: "portrait, keyboard open — iOS reports landscape", w: 390, h: 370, touch: true, expect: "none" },
    { name: "portrait, small phone, keyboard open", w: 320, h: 300, touch: true, expect: "none" },
    { name: "portrait, no keyboard", w: 390, h: 844, touch: true, expect: "none" },
    { name: "landscape, iPhone SE — the narrowest phone there is", w: 568, h: 320, touch: true, expect: "flex" },
    { name: "landscape, iPhone 14 Pro Max", w: 932, h: 430, touch: true, expect: "flex" },
    { name: "landscape, iPad — has the room, gets the app", w: 1024, h: 768, touch: true, expect: "none" },
    { name: "desktop, short window", w: 1280, h: 460, touch: false, expect: "none" },
];

const browser = await chromium.launch();
let failed = 0;

const open = async (w, h, touch) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, colorScheme: "dark" });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-landscape-guard]", { state: "attached" });
    return { ctx, page };
};
const display = (page) => page.$eval("[data-landscape-guard]", (el) => getComputedStyle(el).display);
const report = (ok, line) => {
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${line}`);
};

for (const c of CASES) {
    const { ctx, page } = await open(c.w, c.h, c.touch);
    const got = await display(page);
    report(got === c.expect, `${`${c.w}x${c.h}`.padEnd(9)} ${got.padEnd(5)} (want ${c.expect})  ${c.name}`);
    await ctx.close();
}

// Genuinely sideways, but a field has focus: the keyboard wins. Better to leave
// someone typing at an awkward angle than to take the field away mid-word.
{
    const { ctx, page } = await open(568, 320, true);
    const before = await display(page);
    await page.evaluate(() => {
        const input = document.createElement("input");
        document.body.append(input);
        input.focus();
    });
    const after = await display(page);
    report(before === "flex" && after === "none", `568x320   ${before} -> ${after} while typing (want flex -> none)`);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} failed` : "\nall pass");
process.exit(failed ? 1 : 0);
