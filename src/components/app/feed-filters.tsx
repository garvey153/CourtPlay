import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, SearchLg, X } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import type { FilterState } from "@/types/feed";

// Descriptive NTRP language per the design. `id` is the value matched against
// post.skill_level (posts currently range 2.5–5.0).
const SKILL_LEVELS = [
    { id: "1.5", label: "NTRP 1.0 to 1.5 (New Player)" },
    { id: "2.0", label: "NTRP 2.0 (Beginner)" },
    { id: "2.5", label: "NTRP 2.5 (Advanced Beginner)" },
    { id: "3.0", label: "NTRP 3.0 (Lower-Intermediate)" },
    { id: "3.5", label: "NTRP 3.5 (Intermediate)" },
    { id: "4.0", label: "NTRP 4.0 (Intermediate-Advanced)" },
    { id: "4.5", label: "NTRP 4.5 (Advanced)" },
    { id: "5.0", label: "NTRP 5.0 to 7.0 (Pro)" },
];

// Play type supersedes the old `format` field for sub_need posts.
const PLAY_TYPES = [
    { id: "point_play", label: "Point play" },
    { id: "clinic", label: "Clinic" },
    { id: "round_robin", label: "Round robin" },
    { id: "lesson", label: "Lesson" },
    { id: "other", label: "Other" },
];

const EMPTY: FilterState = { skillLevels: [], formats: [], dateFrom: null, dateTo: null, courtIds: [] };

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

type View = "base" | "play" | "skill" | "location" | "date";

export function activeCount(f: FilterState): number {
    return (
        f.skillLevels.length +
        f.formats.length +
        (f.dateFrom ? 1 : 0) +
        (f.dateTo ? 1 : 0) +
        f.courtIds.length
    );
}

function summarize(labels: string[], placeholder: string): string {
    if (labels.length === 0) return placeholder;
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.length} selected`;
}

/** A checkbox row used inside a category detail view. */
function CheckRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onClick}
            className="flex h-9 w-full items-center gap-2 bg-tertiary px-3 text-left transition duration-100 ease-linear hover:brightness-110"
        >
            <span
                className={cx(
                    "flex size-4 shrink-0 items-center justify-center rounded",
                    checked ? "bg-brand-500" : "border border-neutral-200",
                )}
            >
                {checked && <Check className="size-3 text-white" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className="text-sm text-secondary">{label}</span>
        </button>
    );
}

/** Wraps checkbox rows so only the outer corners round and 4px gaps show between. */
function CheckGroup({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col gap-1 overflow-hidden rounded-lg">{children}</div>;
}

export function FeedFilters({ filters, onChange, courts, isOpen, onToggle }: FeedFiltersProps) {
    const [view, setView] = useState<View>("base");
    const [draft, setDraft] = useState<FilterState>(filters);
    const [locQuery, setLocQuery] = useState("");

    // Re-sync the draft each time the sheet opens; reset to the base view.
    useEffect(() => {
        if (isOpen) {
            setDraft(filters);
            setView("base");
            setLocQuery("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onToggle();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onToggle]);

    const toggleArray = (key: "skillLevels" | "formats" | "courtIds", value: string) =>
        setDraft((d) => ({
            ...d,
            [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
        }));

    const showResults = () => {
        onChange(draft);
        onToggle();
    };
    // Clear all wipes any applied filters and closes the sheet (feed shows all posts).
    const clearAll = () => {
        onChange(EMPTY);
        onToggle();
    };

    const resetCategory = () => {
        if (view === "play") setDraft((d) => ({ ...d, formats: [] }));
        else if (view === "skill") setDraft((d) => ({ ...d, skillLevels: [] }));
        else if (view === "location") setDraft((d) => ({ ...d, courtIds: [] }));
        else if (view === "date") setDraft((d) => ({ ...d, dateFrom: null, dateTo: null }));
    };

    const playLabels = draft.formats.map((id) => PLAY_TYPES.find((p) => p.id === id)?.label ?? id);
    const courtLabels = draft.courtIds
        .map((id) => courts.find((c) => c.id === id)?.name)
        .filter(Boolean) as string[];
    const dateSummary =
        draft.dateFrom || draft.dateTo ? `${draft.dateFrom ?? "Any"} – ${draft.dateTo ?? "Any"}` : "Any dates";

    // The detail-view Apply button is disabled until the category has a selection.
    const categoryHasSelection =
        view === "play"
            ? draft.formats.length > 0
            : view === "skill"
              ? draft.skillLevels.length > 0
              : view === "location"
                ? draft.courtIds.length > 0
                : view === "date"
                  ? !!(draft.dateFrom || draft.dateTo)
                  : true;

    const filteredCourts = locQuery
        ? courts.filter((c) => c.name.toLowerCase().includes(locQuery.toLowerCase()))
        : courts;

    const DETAIL_TITLES: Record<Exclude<View, "base">, string> = {
        play: "Play types",
        skill: "Skill levels",
        location: "Locations",
        date: "Date range",
    };

    function CategoryRow({ label, summary, onClick }: { label: string; summary: string; onClick: () => void }) {
        const isPlaceholder = summary === label;
        return (
            <button
                type="button"
                onClick={onClick}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-tertiary px-3 py-2.5 text-left"
            >
                <span className={cx("truncate text-sm font-semibold", isPlaceholder ? "text-tertiary" : "text-primary")}>
                    {summary}
                </span>
                <ChevronRight className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
            </button>
        );
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Filter posts"
                >
                    <div className="absolute inset-0 bg-black/60" onClick={onToggle} aria-hidden="true" />

                    <motion.div
                        className="relative flex h-[520px] max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl bg-secondary shadow-xl sm:rounded-2xl"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 38, stiffness: 420 }}
                    >
                        {/* Header */}
                        <div className="relative shrink-0 px-5 pt-[18px]">
                            {view === "base" ? (
                                <h2 className="text-md font-semibold text-primary">Filter posts</h2>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setView("base")}
                                    className="flex items-center gap-2 text-md font-semibold text-primary"
                                >
                                    <ChevronLeft className="size-4 text-tertiary" aria-hidden="true" />
                                    {DETAIL_TITLES[view]}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onToggle}
                                aria-label="Close"
                                className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-quaternary hover:text-tertiary"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 pt-6">
                            {view === "base" && (
                                <div className="flex flex-col gap-6">
                                    <CategoryRow
                                        label="All play types"
                                        summary={summarize(playLabels, "All play types")}
                                        onClick={() => setView("play")}
                                    />
                                    <CategoryRow
                                        label="All skill levels"
                                        summary={summarize(draft.skillLevels, "All skill levels")}
                                        onClick={() => setView("skill")}
                                    />
                                    {courts.length > 0 && (
                                        <CategoryRow
                                            label="All locations"
                                            summary={summarize(courtLabels, "All locations")}
                                            onClick={() => setView("location")}
                                        />
                                    )}
                                    <CategoryRow
                                        label="Any dates"
                                        summary={dateSummary}
                                        onClick={() => setView("date")}
                                    />
                                </div>
                            )}

                            {view === "play" && (
                                <CheckGroup>
                                    {PLAY_TYPES.map((p) => (
                                        <CheckRow
                                            key={p.id}
                                            label={p.label}
                                            checked={draft.formats.includes(p.id)}
                                            onClick={() => toggleArray("formats", p.id)}
                                        />
                                    ))}
                                </CheckGroup>
                            )}

                            {view === "skill" && (
                                <CheckGroup>
                                    {SKILL_LEVELS.map((s) => (
                                        <CheckRow
                                            key={s.id}
                                            label={s.label}
                                            checked={draft.skillLevels.includes(s.id)}
                                            onClick={() => toggleArray("skillLevels", s.id)}
                                        />
                                    ))}
                                </CheckGroup>
                            )}

                            {view === "location" && (
                                <>
                                    <div className="flex h-9 items-center gap-2 rounded-lg border border-neutral-600 bg-tertiary px-3">
                                        <SearchLg className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
                                        <input
                                            value={locQuery}
                                            onChange={(e) => setLocQuery(e.target.value)}
                                            placeholder="Search locations"
                                            className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                                        />
                                    </div>
                                    <p className="px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-tertiary">
                                        Nearby courts
                                    </p>
                                    {filteredCourts.length > 0 && (
                                        <CheckGroup>
                                            {filteredCourts.map((c) => (
                                                <CheckRow
                                                    key={c.id}
                                                    label={c.name}
                                                    checked={draft.courtIds.includes(c.id)}
                                                    onClick={() => toggleArray("courtIds", c.id)}
                                                />
                                            ))}
                                        </CheckGroup>
                                    )}
                                    {filteredCourts.length === 0 && (
                                        <p className="px-1 py-2 text-sm text-tertiary">No courts match “{locQuery}”.</p>
                                    )}
                                </>
                            )}

                            {view === "date" && (
                                <div className="flex flex-col gap-2">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-tertiary">From</span>
                                        <input
                                            type="date"
                                            value={draft.dateFrom ?? ""}
                                            onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value || null }))}
                                            className="rounded-lg border border-neutral-600 bg-tertiary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-tertiary">To</span>
                                        <input
                                            type="date"
                                            value={draft.dateTo ?? ""}
                                            onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value || null }))}
                                            className="rounded-lg border border-neutral-600 bg-tertiary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 flex-col gap-3 px-5 pb-8 pt-4">
                            <button
                                type="button"
                                onClick={view === "base" ? showResults : () => setView("base")}
                                disabled={view === "base" ? activeCount(draft) === 0 : !categoryHasSelection}
                                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {view === "base" ? "Show results" : "Apply"}
                            </button>
                            <button
                                type="button"
                                onClick={view === "base" ? clearAll : resetCategory}
                                className="rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                            >
                                {view === "base" ? "Clear all" : "Reset"}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
