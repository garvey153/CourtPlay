import type { ReactNode } from "react";
import { Check } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/**
 * A checkbox and its label, sharing one box treatment: 16px, rounded, filled
 * brand with a white check when on, a hairline border when off.
 *
 * Two variants, because the box is the shared part and the surround is not:
 *
 *   filled — a tinted full-width band. The feed filter sheet's court list,
 *            where the rows are a list and the band groups them.
 *   bare   — box and label on the page background. Settings on the Manage
 *            screen, where each checkbox is its own field, not a list row.
 *
 * `role="checkbox"` on a button rather than a real input: the whole row is the
 * hit target, which a native checkbox plus label cannot give without wrapping
 * it in a label and fighting that label's click handling.
 */
export function CheckRow({
    label,
    checked,
    onClick,
    multiline = false,
    variant = "filled",
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
    /** @default 'filled' */
    variant?: "filled" | "bare";
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onClick}
            className={cx(
                "flex w-full text-left transition duration-100 ease-linear",
                // A wrapped label puts the box beside the FIRST line, not the middle
                // of the block.
                multiline ? "items-start" : "items-center",
                variant === "filled"
                    ? cx("gap-2 bg-tertiary px-3 hover:brightness-110", multiline ? "min-h-9 py-2" : "h-9")
                    // 12px to the label, per the design's checkbox rows.
                    : "gap-3",
            )}
        >
            <span
                className={cx(
                    "flex size-4 shrink-0 items-center justify-center rounded",
                    // 2px centres the 16px box on a 20px first line.
                    multiline && "mt-0.5",
                    checked ? "bg-brand-500" : "border border-neutral-200",
                )}
            >
                {checked && <Check className="size-3 text-white" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className={cx("min-w-0 text-sm text-secondary", !multiline && "truncate")}>{label}</span>
        </button>
    );
}

/** Wraps checkbox rows so only the outer corners round and 4px gaps show between. */
export function CheckGroup({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-1 overflow-hidden rounded-lg">{children}</div>;
}
