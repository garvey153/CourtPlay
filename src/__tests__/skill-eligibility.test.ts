import { describe, expect, it } from "vitest";
import { isBelowRequiredLevel } from "@/utils/skill-eligibility";
import { VALID_SKILL_LEVELS } from "@/lib/post-validation";

/**
 * The claim floor: a player may claim at their own level or above it. Any
 * amount below is refused, including a single 0.5 step — that half-step is the
 * case worth pinning, since it is the one an "about right" implementation lets
 * through.
 */
describe("isBelowRequiredLevel", () => {
    it("same level claims", () => {
        expect(isBelowRequiredLevel("4.0", "4.0")).toBe(false);
    });

    it("half a step below cannot claim", () => {
        expect(isBelowRequiredLevel("3.5", "4.0")).toBe(true);
    });

    it("further below cannot claim", () => {
        expect(isBelowRequiredLevel("3.0", "4.0")).toBe(true);
        expect(isBelowRequiredLevel("2.5", "5.0")).toBe(true);
    });

    it("playing up is never restricted", () => {
        expect(isBelowRequiredLevel("5.0", "2.5")).toBe(false);
        expect(isBelowRequiredLevel("4.0", "3.5")).toBe(false);
    });

    it("a missing rating on either side does not block", () => {
        expect(isBelowRequiredLevel(null, "4.0")).toBe(false);
        expect(isBelowRequiredLevel("2.5", null)).toBe(false);
        expect(isBelowRequiredLevel(undefined, undefined)).toBe(false);
        expect(isBelowRequiredLevel("", "4.0")).toBe(false);
    });

    it("garbage does not block either", () => {
        expect(isBelowRequiredLevel("unrated", "4.0")).toBe(false);
        expect(isBelowRequiredLevel("3.0", "open")).toBe(false);
    });

    it("holds for every pair of real levels: blocked exactly when rated lower", () => {
        for (const viewer of VALID_SKILL_LEVELS) {
            for (const post of VALID_SKILL_LEVELS) {
                expect(isBelowRequiredLevel(viewer, post)).toBe(Number(viewer) < Number(post));
            }
        }
    });
});
