import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "@/lib/notifications";
import {
    DEFAULT_CHANNELS,
    type NotificationType,
} from "../../supabase/functions/_shared/notification-defaults.ts";

/**
 * The client and the server describe the same decision in two places.
 *
 * `NOTIFICATION_TYPES` drives the preferences screen and what onboarding seeds;
 * `DEFAULT_CHANNELS` decides what actually gets sent when a user has no
 * preference row. They must agree, and they didn't: four separate lists of
 * notification types existed and three were wrong — onboarding seeded rows for
 * `nudge_12h` and `nudge_48h` (neither is a real type) while omitting six real
 * ones, and the preferences screen had no row at all for `connection_request` or
 * `connection_closed`, so those fired with no way to opt out.
 *
 * These tests are the reason that can't drift again. Extracting DEFAULT_CHANNELS
 * into a Deno-free module is what makes it importable from here.
 */
const clientKeys = NOTIFICATION_TYPES.map((t) => t.key).sort();
const serverKeys = (Object.keys(DEFAULT_CHANNELS) as NotificationType[]).sort();

describe("notification type registry", () => {
    it("covers exactly the same types on both sides", () => {
        expect(clientKeys).toEqual(serverKeys);
    });

    it("has no duplicate keys", () => {
        expect(new Set(clientKeys).size).toBe(clientKeys.length);
    });

    it.each(NOTIFICATION_TYPES)(
        "$key: client defaults match the server's",
        ({ key, defaultPush, defaultEmail }) => {
            expect(DEFAULT_CHANNELS[key]).toEqual({ push: defaultPush, email: defaultEmail });
        },
    );

    it("gives every type a label and a hint", () => {
        for (const t of NOTIFICATION_TYPES) {
            expect(t.label.length).toBeGreaterThan(0);
            expect(t.hint.length).toBeGreaterThan(0);
        }
    });

    // A type absent from the seed list gets no preference row, so the choice made
    // during onboarding silently doesn't apply to it — the original bug.
    it("seeds every non-admin type during onboarding", async () => {
        const { SEEDED_NOTIFICATION_TYPES } = await import("@/lib/notifications");
        const expected = NOTIFICATION_TYPES.filter((t) => !t.adminOnly).map((t) => t.key);

        expect([...SEEDED_NOTIFICATION_TYPES].sort()).toEqual([...expected].sort());
    });

    it("never seeds admin-only types", async () => {
        const { SEEDED_NOTIFICATION_TYPES } = await import("@/lib/notifications");
        const adminOnly = NOTIFICATION_TYPES.filter((t) => t.adminOnly).map((t) => t.key);

        expect(adminOnly.length).toBeGreaterThan(0); // guard: the case is real
        for (const key of adminOnly) {
            expect(SEEDED_NOTIFICATION_TYPES).not.toContain(key);
        }
    });
});
