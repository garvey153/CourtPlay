// Maps an NTRP skill_level ("3.5") to the word descriptor shown on the profile
// header (e.g. "Intermediate"). Mirrors the onboarding rating labels.
const SKILL_LABELS: Record<string, string> = {
    "2.0": "Beginner",
    "2.5": "Beginner",
    "3.0": "Beginner+",
    "3.5": "Intermediate",
    "4.0": "Intermediate+",
    "4.5": "Advanced",
    "5.0": "Expert",
    "5.5": "Expert",
};

export function skillLabel(level: string | null | undefined): string | null {
    if (!level) return null;
    return SKILL_LABELS[level] ?? `NTRP ${level}`;
}
