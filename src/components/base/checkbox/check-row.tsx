import type { ReactNode } from "react";
import { Check } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/**
 * The filled checkbox row: a full-width tinted band with a brand-filled box.
 *
 * It started as the court list in the feed filter sheet and is shared so the
 * Manage screen's settings read the same way — one checkbox treatment across
 * the app rather than this and the bare {@link Checkbox} sitting side by side.
 *
 * `role="checkbox"` on a button rather than a real input: the whole row is the
 * hit target, which a native checkbox plus label cannot give without wrapping
 * the band in a label and fighting its click handling.
 */
export function CheckRow({
    label,
    checked,
    onClick,
    multiline = false,
}: {
    label: ReactNode;
    checked: boolean;
    onClick: () => void;
    /**
     * Let the label wrap instead of truncating. Court names are short and a
     * fixed 36px row keeps that list even, but a settings label is a sentence
     * and truncating one would hide what the setting does.
     */
    multiline?: boolean;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onClick}
            className={cx(
                "flex w-full items-center gap-2 bg-tertiary px-3 text-left transition duration-100 ease-linear hover:brightness-110",
                multiline ? "min-h-9 py-2" : "h-9",
            )}
        >
            <span
                className={cx(
                    "flex size-4 shrink-0 items-center justify-center rounded",
                    checked ? "bg-brand-500" : "border border-neutral-200",
                )}
            >
                {checked && <Check className="size-3 text-white" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className={cx("min-w-0 text-sm text-secondary", multiline ? "text-balance" : "truncate")}>{label}</span>
        </button>
    );
}

/** Wraps checkbox rows so only the outer corners round and 4px gaps show between. */
export function CheckGroup({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-1 overflow-hidden rounded-lg">{children}</div>;
}
