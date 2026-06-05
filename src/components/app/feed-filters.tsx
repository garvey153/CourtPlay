import { FilterLines, X } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import type { FilterState } from "@/types/feed";

const SKILL_LEVELS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];
const FORMATS = [
    { id: "point_play", label: "Point play" },
    { id: "clinic", label: "Clinic" },
    { id: "lesson", label: "Lesson" },
    { id: "round_robin", label: "Round robin" },
    { id: "other", label: "Other" },
];

interface Court {
    id: string;
    name: string;
}

interface FeedFiltersProps {
    filters: FilterState;
    onChange: (f: FilterState) => void;
    courts: Court[];
    isOpen: boolean;
    onToggle: () => void;
}

function activeCount(f: FilterState): number {
    return (
        f.skillLevels.length +
        f.formats.length +
        (f.dateFrom ? 1 : 0) +
        (f.dateTo ? 1 : 0) +
        (f.courtId ? 1 : 0)
    );
}

function Chip({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cx(
                "rounded-full border px-3 py-1 text-sm font-medium transition duration-100 ease-linear",
                active
                    ? "border-brand bg-brand-secondary text-brand-primary"
                    : "border-secondary bg-primary text-secondary hover:bg-secondary",
            )}
        >
            {label}
        </button>
    );
}

export function FeedFilters({ filters, onChange, courts, isOpen, onToggle }: FeedFiltersProps) {
    const count = activeCount(filters);

    const toggleSkill = (v: string) => {
        const next = filters.skillLevels.includes(v)
            ? filters.skillLevels.filter((s) => s !== v)
            : [...filters.skillLevels, v];
        onChange({ ...filters, skillLevels: next });
    };

    const toggleFormat = (v: string) => {
        const next = filters.formats.includes(v)
            ? filters.formats.filter((f) => f !== v)
            : [...filters.formats, v];
        onChange({ ...filters, formats: next });
    };

    const clearAll = () =>
        onChange({ skillLevels: [], formats: [], dateFrom: null, dateTo: null, courtId: null });

    return (
        <div className="border-b border-secondary bg-primary">
            {/* Filter bar */}
            <div className="flex items-center gap-2 px-4 py-2">
                <button
                    onClick={onToggle}
                    className={cx(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition duration-100 ease-linear",
                        isOpen || count > 0
                            ? "border-brand bg-brand-secondary text-brand-primary"
                            : "border-secondary bg-primary text-secondary hover:bg-secondary",
                    )}
                >
                    <FilterLines className="size-4" />
                    Filters
                    {count > 0 && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-brand-solid text-xs text-white">
                            {count}
                        </span>
                    )}
                </button>
                {count > 0 && (
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-1 text-sm text-tertiary hover:text-secondary"
                    >
                        <X className="size-3.5" />
                        Clear
                    </button>
                )}
            </div>

            {/* Expanded panel */}
            {isOpen && (
                <div className="flex flex-col gap-4 px-4 pb-4">
                    {/* Skill level */}
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary">
                            Skill level
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {SKILL_LEVELS.map((s) => (
                                <Chip
                                    key={s}
                                    label={s}
                                    active={filters.skillLevels.includes(s)}
                                    onClick={() => toggleSkill(s)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Format */}
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary">
                            Format
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {FORMATS.map((f) => (
                                <Chip
                                    key={f.id}
                                    label={f.label}
                                    active={filters.formats.includes(f.id)}
                                    onClick={() => toggleFormat(f.id)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Date range */}
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary">
                            Date range
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={filters.dateFrom ?? ""}
                                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
                                className="flex-1 rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
                                placeholder="From"
                            />
                            <span className="text-tertiary">–</span>
                            <input
                                type="date"
                                value={filters.dateTo ?? ""}
                                onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
                                className="flex-1 rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
                                placeholder="To"
                            />
                        </div>
                    </div>

                    {/* Court */}
                    {courts.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary">
                                Court
                            </p>
                            <select
                                value={filters.courtId ?? ""}
                                onChange={(e) =>
                                    onChange({ ...filters, courtId: e.target.value || null })
                                }
                                className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
                            >
                                <option value="">All courts</option>
                                {courts.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
