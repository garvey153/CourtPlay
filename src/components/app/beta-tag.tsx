import { cx } from "@/utils/cx";

interface BetaTagProps {
    className?: string;
}

/**
 * "Beta" pill shown beside the CourtPlay logo (Figma 528:1739). White pill, 16px
 * tall, 4px radius, 6px horizontal padding, 12px semibold in neutral-950 (#08180e).
 *
 * Sized and nudged (-translate-y-px) to align its top and bottom with the logo's
 * "P" at the logo's base h-6 size. Placed in a `gap-2` flex row next to the logo,
 * the 8px gap lands 8px from the "y" (the logo viewBox is tight to it). Shared so
 * the app header and landing header stay identical.
 */
export function BetaTag({ className }: BetaTagProps) {
    return (
        <span
            className={cx(
                "inline-flex h-4 shrink-0 -translate-y-px items-center rounded bg-white px-1.5 text-xs font-semibold text-neutral-950",
                className,
            )}
        >
            Beta
        </span>
    );
}
