import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");

/**
 * The no-JS fallback used to render inside #root and be replaced when React
 * mounted. Every page load painted a paragraph about CourtPlay first — signed in
 * or not, on every route, since they all serve this one file. Measured on the
 * deployed page at the time: 4 sampled frames out of 30.
 *
 * In <noscript> it is not rendered at all when scripting is on, and is still
 * there for a reader that needs it. These pin both halves, because the fallback
 * is invisible in normal use and a regression would be silent.
 */
describe("index.html no-JS fallback", () => {
    it("lives in <noscript>, so a scripted browser never paints it", () => {
        const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
        expect(noscript).not.toBeNull();
        expect(noscript![1]).toContain("CourtPlay helps tennis players fill an open spot");
        expect(noscript![1]).toContain("How CourtPlay works:");
    });

    it("leaves #root empty, so React has nothing to replace", () => {
        expect(html).toContain('<div id="root"></div>');
    });

    it("still names the app and its purpose in the head, for metadata readers", () => {
        expect(html).toMatch(/<title>[^<]*CourtPlay/);
        expect(html).toMatch(/name="description" content="CourtPlay helps tennis players fill an open spot/);
        expect(html).toMatch(/property="og:site_name" content="CourtPlay"/);
        expect(html).toContain('"@type": "WebApplication"');
    });
});
