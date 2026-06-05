import { describe, expect, it } from "vitest";
import { VALID_FORMATS, VALID_SKILL_LEVELS, validateRegularGame, validateSubNeed } from "./post-validation";

// ── Fixtures ───────────────────────────────────────────────────────────────

const VALID_SUB_NEED = {
    format: "point_play",
    game_date: "2026-04-15",
    game_time: "09:00",
    skill_level: "4.0",
    court_id: "court-1",
    cost: 25,
    notes: "",
    spots_total: 1,
};

const VALID_REGULAR_GAME = {
    skill_level: "4.0",
    preferred_days: ["Mon", "Wed"],
    preferred_times: ["Morning"],
    notes: "",
};

// ── Sub need form validation ───────────────────────────────────────────────

describe("validateSubNeed", () => {
    it("valid data returns no errors", () => {
        expect(validateSubNeed(VALID_SUB_NEED)).toEqual({});
    });

    it("missing format returns error on format field", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, format: "" });
        expect(errors.format).toBeDefined();
    });

    it("missing game_date returns error on game_date field", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, game_date: "" });
        expect(errors.game_date).toBeDefined();
    });

    it("missing game_time returns error on game_time field", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, game_time: "" });
        expect(errors.game_time).toBeDefined();
    });

    it("missing skill_level returns error on skill_level field", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, skill_level: "" });
        expect(errors.skill_level).toBeDefined();
    });

    it("missing court selection (no court_id and no custom_court) returns error", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, court_id: null, custom_court: "" });
        expect(errors.court).toBeDefined();
    });

    it("custom_court alone satisfies the court requirement", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, court_id: null, custom_court: "My Club" });
        expect(errors.court).toBeUndefined();
    });

    it("missing cost returns error on cost field", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, cost: null });
        expect(errors.cost).toBeDefined();
    });

    it("cost of 0 is valid (free games exist)", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, cost: 0 });
        expect(errors.cost).toBeUndefined();
    });

    it("negative cost returns error", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, cost: -1 });
        expect(errors.cost).toBeDefined();
    });

    it("notes exceeding 100 characters returns error on notes field", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, notes: "x".repeat(101) });
        expect(errors.notes).toBeDefined();
    });

    it("notes of exactly 100 characters is valid", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, notes: "x".repeat(100) });
        expect(errors.notes).toBeUndefined();
    });

    it("spots_total of 0 returns error", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, spots_total: 0 });
        expect(errors.spots_total).toBeDefined();
    });

    it("spots_total above 8 returns error", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, spots_total: 9 });
        expect(errors.spots_total).toBeDefined();
    });
});

// ── Regular game form validation ───────────────────────────────────────────

describe("validateRegularGame", () => {
    it("valid data returns no errors", () => {
        expect(validateRegularGame(VALID_REGULAR_GAME)).toEqual({});
    });

    it("missing skill_level returns error", () => {
        const errors = validateRegularGame({ ...VALID_REGULAR_GAME, skill_level: "" });
        expect(errors.skill_level).toBeDefined();
    });

    it("notes exceeding 150 characters returns error", () => {
        const errors = validateRegularGame({ ...VALID_REGULAR_GAME, notes: "x".repeat(151) });
        expect(errors.notes).toBeDefined();
    });

    it("notes of exactly 150 characters is valid", () => {
        const errors = validateRegularGame({ ...VALID_REGULAR_GAME, notes: "x".repeat(150) });
        expect(errors.notes).toBeUndefined();
    });

    it("empty preferred_days array returns error", () => {
        const errors = validateRegularGame({ ...VALID_REGULAR_GAME, preferred_days: [] });
        expect(errors.preferred_days).toBeDefined();
    });

    it("empty preferred_times array returns error", () => {
        const errors = validateRegularGame({ ...VALID_REGULAR_GAME, preferred_times: [] });
        expect(errors.preferred_times).toBeDefined();
    });
});

// ── Format values ──────────────────────────────────────────────────────────

describe("format validation", () => {
    it.each(VALID_FORMATS)("'%s' is accepted as a valid format", (format) => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, format });
        expect(errors.format).toBeUndefined();
    });

    it("invalid format value returns error", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, format: "doubles_match" });
        expect(errors.format).toBeDefined();
    });
});

// ── Skill level values ─────────────────────────────────────────────────────

describe("skill level validation", () => {
    it.each(VALID_SKILL_LEVELS)("'%s' is accepted as a valid skill level", (level) => {
        const subErrors = validateSubNeed({ ...VALID_SUB_NEED, skill_level: level });
        expect(subErrors.skill_level).toBeUndefined();

        const rgErrors = validateRegularGame({ ...VALID_REGULAR_GAME, skill_level: level });
        expect(rgErrors.skill_level).toBeUndefined();
    });

    it("invalid skill level returns error", () => {
        const errors = validateSubNeed({ ...VALID_SUB_NEED, skill_level: "6.0" });
        expect(errors.skill_level).toBeDefined();
    });
});
