import { FilterLines } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface FilterButtonProps {
    onClick: () => void;
    /** Shows the active-filter dot when any filter is applied. */
    isActive: boolean;
    /** Accessible name, e.g. "Filter posts" / "Filter claims". */
    label: string;
    className?: string;
}

/**
 * Icon button that opens a filter sheet, with the active-filter dot.
 *
 * Shared so the dot's size, position and ring stay identical everywhere filters are
 * offered. The markup had been copied per screen and the feed's copy drifted — a
 * larger 8px dot, 3px higher, ringed with `ring-primary` (a *border* token) instead
 * of `ring-bg-primary`, which drew a contrasting outline rather than blending into
 * the surface behind it.
 */
export function FilterButton({ onClick, isActive, label, className }: FilterButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cx(
                "relative shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary",
                className,
            )}
        >
            <FilterLines className="size-6" aria-hidden="true" />
            {isActive && (
                // The ring matches the surrounding background so the dot reads as a
                // clean cutout against the icon rather than an outlined badge.
                <span className="absolute right-1 top-[7px] size-1.5 rounded-full bg-brand-solid ring-2 ring-bg-primary" />
            )}
        </button>
    );
}
