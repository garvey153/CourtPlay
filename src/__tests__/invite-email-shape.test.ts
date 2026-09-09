import { describe, expect, it } from "vitest";

/**
 * What the invite email may and may not contain.
 *
 * Invites were landing in Gmail's spam folder. Authentication was not the cause
 * — SPF, DKIM and DMARC all pass — so the message itself and the domain's
 * reputation were doing the damage. The single worst signal was the link:
 *
 *     https://www.courtplay.app/signup?email=someone@gmail.com
 *
 * A clickable link to an account-creation page carrying the recipient's own
 * address is the shape of a credential-harvest email, and filters weigh it
 * heavily. It is now a per-invite token that resolves server-side.
 *
 * These read the edge function's SOURCE rather than running it: it is Deno, it
 * talks to Resend and to the database, and none of that belongs in this suite.
 * A source assertion is a smoke alarm, not a proof — but the failure it is
 * guarding against is someone reintroducing the address into the URL, and that
 * is visible in the source.
 */
describe("invite email", () => {
    const load = async () => (await import("../../supabase/functions/send-invite/index.ts?raw")).default as string;

    it("builds the link from a token, never from the address", async () => {
        const source = await load();
        expect(source).toContain("/signup?invite=${encodeURIComponent(tokenRow.token)}");

        // The old shape survives as a fallback for an invite with no token, and
        // that is the only place the address may appear in a URL.
        const addressInUrl = [...source.matchAll(/\/signup\?email=\$\{[^}]*\}/g)];
        expect(addressInUrl).toHaveLength(1);
    });

    it("sends a plain-text alternative alongside the HTML", async () => {
        const source = await load();
        expect(source).toContain("text: buildInviteText(");
        expect(source).toContain("function buildInviteText(");
    });

    it("gives a reply somewhere to land, and an exit that is not the spam button", async () => {
        const source = await load();
        expect(source).toContain("replyTo: REPLY_TO");
        expect(source).toContain('"List-Unsubscribe"');
        expect(source).toContain('"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"');
    });

    /**
     * Both bodies carry the same promises, so both need the footer. The plain
     * text one is easy to forget precisely because nobody looks at it.
     */
    it("puts the unsubscribe line in both bodies", async () => {
        const source = await load();
        const mentions = [...source.matchAll(/Reply with "unsubscribe"/g)];
        expect(mentions).toHaveLength(2);
    });

    /**
     * The postal address is configuration, not a literal: CAN-SPAM requires a
     * real one and a made-up one would be worse than none. Unset drops the line
     * rather than printing an empty bullet or the word "undefined".
     */
    it("omits the postal address when it is not configured", async () => {
        const source = await load();
        expect(source).toContain('const POSTAL_ADDRESS = Deno.env.get("POSTAL_ADDRESS") ?? ""');
        expect(source).toContain("POSTAL_ADDRESS ? ");
    });
});
