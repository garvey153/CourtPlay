import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";

export type UserStatus = "all" | "active" | "suspended";

export interface UserFilters {
    status: UserStatus;
    adminsOnly: boolean;
}

export const EMPTY_USER_FILTERS: UserFilters = { status: "all", adminsOnly: false };

/** Number of applied (non-default) filters — drives the filter icon's active dot. */
export function userFilterCount(f: UserFilters): number {
    return (f.status !== "all" ? 1 : 0) + (f.adminsOnly ? 1 : 0);
}

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Deactivated" },
];

const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Option row matching the feed filters' row style, but with a circular green
 * radio (primary treatment) instead of a square checkbox.
 */
function OptionRow({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onClick}
            className="flex h-9 w-full items-center gap-2 bg-tertiary px-3 text-left transition duration-100 ease-linear hover:brightness-110"
        >
            <span
                className={cx(
                    "flex size-4 shrink-0 items-center justify-center rounded-full",
                    selected ? "bg-brand-500" : "border border-neutral-200",
                )}
            >
                {selected && <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />}
            </span>
            <span className="min-w-0 truncate text-sm text-secondary">{label}</span>
        </button>
    );
}

/** Rounds the outer corners and shows 4px gaps between rows (matches feed filters). */
function OptionGroup({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className="flex flex-col gap-1 overflow-hidden rounded-lg" {...props}>
            {children}
        </div>
    );
}

interface AdminUserFilterSheetProps {
    filters: UserFilters;
    onChange: (f: UserFilters) => void;
    isOpen: boolean;
    onToggle: () => void;
}

/** Bottom sheet to filter the admin users list by status and admin flag. */
export function AdminUserFilterSheet({ filters, onChange, isOpen, onToggle }: AdminUserFilterSheetProps) {
    // Local draft so filters only apply on "Show results".
    const [draft, setDraft] = useState<UserFilters>(filters);

    // Sync the draft to the applied filters whenever the sheet (re)opens.
    useEffect(() => {
        if (isOpen) setDraft(filters);
    }, [isOpen, filters]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) onToggle();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onToggle]);

    if (!isOpen) return null;

    const showResults = () => {
        onChange(draft);
        onToggle();
    };
    const clearAll = () => {
        setDraft(EMPTY_USER_FILTERS);
        onChange(EMPTY_USER_FILTERS);
        onToggle();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-filter-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onToggle} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-5 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-center justify-between gap-3">
                    <h2 id="admin-user-filter-title" className="text-md font-semibold text-primary">
                        Filter users
                    </h2>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-label="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" strokeWidth={1} />
                    </button>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-secondary">Status</p>
                    <OptionGroup role="radiogroup" aria-label="Status">
                        {STATUS_OPTIONS.map((opt) => (
                            <OptionRow
                                key={opt.value}
                                label={opt.label}
                                selected={draft.status === opt.value}
                                onClick={() => setDraft((d) => ({ ...d, status: opt.value }))}
                            />
                        ))}
                    </OptionGroup>
                </div>

                {/* Admins only */}
                <Checkbox
                    label="Admins only"
                    isSelected={draft.adminsOnly}
                    onChange={(isSelected) => setDraft((d) => ({ ...d, adminsOnly: isSelected }))}
                />

                <div className="mt-1 flex flex-col gap-3">
                    <button type="button" onClick={showResults} className={PRIMARY_BTN}>
                        Show results
                    </button>
                    <button type="button" onClick={clearAll} className={SECONDARY_BTN}>
                        Clear all
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
