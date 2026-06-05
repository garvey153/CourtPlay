export const VALID_FORMATS = ["point_play", "clinic", "lesson", "round_robin", "other"] as const;
export const VALID_SKILL_LEVELS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"] as const;

export type Format = (typeof VALID_FORMATS)[number];
export type SkillLevel = (typeof VALID_SKILL_LEVELS)[number];

export interface SubNeedFormData {
    format?: string;
    game_date?: string;
    game_time?: string;
    skill_level?: string;
    court_id?: string | null;
    custom_court?: string;
    cost?: number | null;
    notes?: string;
    spots_total?: number;
}

export interface RegularGameFormData {
    skill_level?: string;
    preferred_days?: string[];
    preferred_times?: string[];
    notes?: string;
}

export interface ValidationErrors {
    format?: string;
    game_date?: string;
    game_time?: string;
    skill_level?: string;
    court?: string;
    cost?: string;
    notes?: string;
    spots_total?: string;
    preferred_days?: string;
    preferred_times?: string;
}

export function validateSubNeed(data: SubNeedFormData): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!data.format) {
        errors.format = "Format is required.";
    } else if (!VALID_FORMATS.includes(data.format as Format)) {
        errors.format = `Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}.`;
    }

    if (!data.game_date) {
        errors.game_date = "Game date is required.";
    }

    if (!data.game_time) {
        errors.game_time = "Game time is required.";
    }

    if (!data.skill_level) {
        errors.skill_level = "Skill level is required.";
    } else if (!VALID_SKILL_LEVELS.includes(data.skill_level as SkillLevel)) {
        errors.skill_level = `Invalid skill level. Must be one of: ${VALID_SKILL_LEVELS.join(", ")}.`;
    }

    const hasCourtId = data.court_id && data.court_id.trim().length > 0;
    const hasCustomCourt = data.custom_court && data.custom_court.trim().length > 0;
    if (!hasCourtId && !hasCustomCourt) {
        errors.court = "Court selection is required.";
    }

    if (data.cost === null || data.cost === undefined) {
        errors.cost = "Cost is required.";
    } else if (data.cost < 0) {
        errors.cost = "Cost cannot be negative.";
    }

    if (data.notes && data.notes.length > 100) {
        errors.notes = "Notes must be 100 characters or fewer.";
    }

    const spots = data.spots_total;
    if (spots !== undefined) {
        if (spots < 1) {
            errors.spots_total = "Must have at least 1 spot open.";
        } else if (spots > 8) {
            errors.spots_total = "Maximum 8 spots allowed.";
        }
    }

    return errors;
}

export function validateRegularGame(data: RegularGameFormData): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!data.skill_level) {
        errors.skill_level = "Skill level is required.";
    } else if (!VALID_SKILL_LEVELS.includes(data.skill_level as SkillLevel)) {
        errors.skill_level = `Invalid skill level. Must be one of: ${VALID_SKILL_LEVELS.join(", ")}.`;
    }

    if (!data.preferred_days || data.preferred_days.length === 0) {
        errors.preferred_days = "Select at least one preferred day.";
    }

    if (!data.preferred_times || data.preferred_times.length === 0) {
        errors.preferred_times = "Select at least one preferred time.";
    }

    if (data.notes && data.notes.length > 150) {
        errors.notes = "Notes must be 150 characters or fewer.";
    }

    return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
    return Object.keys(errors).length > 0;
}
