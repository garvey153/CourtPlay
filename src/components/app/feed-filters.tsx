import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import type { FilterState } from "@/types/feed";

const SKILL_LEVELS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

// Play type supersedes the old `format` field for sub_need posts.
const PLAY_TYPES = [
    { id: "doubles", label: "Doubles" },
    { id: "point_play", label: "Point play" },
    { id: "clinic", label: "Clinic" },
    { id: "round_robin", label: "Round robin" },
    { id: "lesson", label: "Lesson" },
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

export function activeCount(f: FilterState): number {
    return (
        f.skillLevels.length +
        f.formats.length +
        (f.dateFrom ? 1 : 0) +
        (f.dateTo ? 1 : 0) +
        (f.courtId ? 1 : 0)
    );
}

function summarize(labels: string[], placeholder: string): string {
    if (labels.length === 0) return placeholder;
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.length} selected`;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                "rounded-full border px-3 py-1 text-sm font-medium transition duration-100 ease-linear",
                active
                    ? "border-brand bg-brand-secondary text-brand-primary"
                    : "border-secondary bg-primary text-secondary hover:bg-secondary_hover",
            )}
        >
            {label}
        </button>
    );
}

/** A collapsible filter category row matching the Figma "Select" row. */
function CategoryRow({
    summary,
    hasSelection,
    isExpanded,
    onToggle,
    children,
}: {
    summary: string;
    hasSelection: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-tertiary px-3 py-2"
            >
                <span className={cx("truncate text-sm font-semibold", hasSelection ? "text-primary" : "text-tertiary")}>
                    {summary}
                </span>
                <ChevronDown
                    className={cx("size-4 shrink-0 text-tertiary transition-transform duration-100", isExpanded ? "" : "-rotate-90")}
                    aria-hidden="true"
                />
            </button>
            {isExpanded && <div className="flex flex-wrap gap-2 px-1 pb-1">{children}</div>}
        </div>
    );
}

export function FeedFilters({ filters, onChange, courts, isOpen, onToggle }: FeedFiltersProps) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (e.target === overlayRef.current) onToggle();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onToggle]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onToggle();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onToggle]);

    const toggleExpanded = (id: string) => setExpanded((cur) => (cur === id ? null : id));

    const toggleSkill = (v: string) => {
        const next = filters.skillLevels.includes(v)
            ? filters.skillLevels.filter((s) => s !== v)
            : [...filters.skillLevels, v];
        onChange({ ...filters, skillLevels: next });
    };

    const togglePlayType = (v: string) => {
        const next = filters.formats.includes(v)
            ? filters.formats.filter((f) => f !== v)
            : [...filters.formats, v];
        onChange({ ...filters, formats: next });
    };

    const toggleCourt = (id: string) =>
        onChange({ ...filters, courtId: filters.courtId === id ? null : id });

    const clearAll = () =>
        onChange({ skillLevels: [], formats: [], dateFrom: null, dateTo: null, courtId: null });

    if (!isOpen) return null;

    const playTypeLabels = filters.formats
        .map((id) => PLAY_TYPES.find((p) => p.id === id)?.label ?? id);
    const courtLabel = courts.find((c) => c.id === filters.courtId)?.name;
    const dateSummary =
        filters.dateFrom || filters.dateTo
            ? `${filters.dateFrom ?? "Any"} – ${filters.dateTo ?? "Any"}`
            : "Any dates";

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Filter posts"
        >
            <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-secondary shadow-xl sm:rounded-2xl">
                {/* Header */}
                <div className="relative shrink-0 px-5 pt-[18px]">
                    <h2 className="text-md font-semibold text-primary">Filter posts</h2>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-label="Close"
                        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-quaternary hover:text-tertiary"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Categories */}
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 pt-6">
                    <CategoryRow
                        summary={summarize(playTypeLabels, "All play types")}
                        hasSelection={filters.formats.length > 0}
                        isExpanded={expanded === "play"}
                        onToggle={() => toggleExpanded("play")}
                    >
                        {PLAY_TYPES.map((p) => (
                            <Chip
                                key={p.id}
                                label={p.label}
                                active={filters.formats.includes(p.id)}
                                onClick={() => togglePlayType(p.id)}
                            />
                        ))}
                    </CategoryRow>

                    <CategoryRow
                        summary={summarize(filters.skillLevels, "All skill levels")}
                        hasSelection={filters.skillLevels.length > 0}
                        isExpanded={expanded === "skill"}
                        onToggle={() => toggleExpanded("skill")}
                    >
                        {SKILL_LEVELS.map((s) => (
                            <Chip
                                key={s}
                                label={s}
                                active={filters.skillLevels.includes(s)}
                                onClick={() => toggleSkill(s)}
                            />
                        ))}
                    </CategoryRow>

                    {courts.length > 0 && (
                        <CategoryRow
                            summary={courtLabel ?? "All locations"}
                            hasSelection={!!filters.courtId}
                            isExpanded={expanded === "location"}
                            onToggle={() => toggleExpanded("location")}
                        >
                            {courts.map((c) => (
                                <Chip
                                    key={c.id}
                                    label={c.name}
                                    active={filters.courtId === c.id}
                                    onClick={() => toggleCourt(c.id)}
                                />
                            ))}
                        </CategoryRow>
                    )}

                    {/* Date range */}
                    <CategoryRow
                        summary={dateSummary}
                        hasSelection={!!(filters.dateFrom || filters.dateTo)}
                        isExpanded={expanded === "date"}
                        onToggle={() => toggleExpanded("date")}
                    >
                        <div className="flex w-full items-center gap-2">
                            <input
                                type="date"
                                aria-label="From date"
                                value={filters.dateFrom ?? ""}
                                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
                                className="flex-1 rounded-lg border border-neutral-600 bg-tertiary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
                            />
                            <span className="text-tertiary">–</span>
                            <input
                                type="date"
                                aria-label="To date"
                                value={filters.dateTo ?? ""}
                                onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
                                className="flex-1 rounded-lg border border-neutral-600 bg-tertiary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
                            />
                        </div>
                    </CategoryRow>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col gap-3 px-5 pb-8 pt-4">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600"
                    >
                        Show results
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        className="rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                    >
                        Clear all
                    </button>
                </div>
            </div>
        </div>
    );
}
