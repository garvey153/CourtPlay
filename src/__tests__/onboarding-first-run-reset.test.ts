import { describe, expect, it } from "vitest";
import { FIRST_RUN_KEYS } from "@/lib/first-run";

/**
 * The feed's one-per-player prompts record dismissal in localStorage, which is
 * per DEVICE. A player whose account is deleted and re-created — or a second
 * player on the same phone — inherits those dismissals and never sees the
 * welcome card or the install prompt.
 *
 * Onboarding clears them on finish. This pins the LIST, which is the part that
 * rots: a new prompt added to the feed with its own key is invisible to this
 * reset unless someone remembers to add it here.
 */

describe("first-run keys", () => {
    it("covers every key the feed's prompts persist", async () => {
        const sources = await Promise.all(
            [
                "../pages/feed.tsx",
                "../components/app/ios-install-prompt.tsx",
                "../components/app/push-prompt.tsx",
                "../components/app/push-enable-banner.tsx",
            ].map(async (m) => (await import(/* @vite-ignore */ `${m}?raw`)).default as string),
        );

        // Every "cs_*" / "courtsub_*" storage key those files name.
        const used = new Set<string>();
        for (const src of sources) {
            for (const [, key] of src.matchAll(/"(cs_[a-z_]+|courtsub_[a-z_]+)"/g)) used.add(key);
        }
        // cs_auth_redirect is a deep link, not a dismissal, and must survive.
        used.delete("cs_auth_redirect");

        expect([...used].sort()).toEqual([...FIRST_RUN_KEYS].sort());
    });
});
