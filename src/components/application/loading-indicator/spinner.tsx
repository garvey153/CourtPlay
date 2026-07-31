import { cx } from "@/utils/cx";

const sizes = {
    xs: "size-4",
    sm: "size-5",
    md: "size-6",
    lg: "size-8",
};

// A dim full ring with a brighter arc on top. Every loader in the app is this
// same shape and animation; only the colour changes with context.
const tones = {
    /** Page and section loaders — the green spinner. */
    brand: "border-border-secondary border-t-brand-solid",
    /** On a filled brand button, where the label is near-black. */
    "on-brand": "border-neutral-950/40 border-t-neutral-950",
    /** Inherits the button's text colour — works on secondary and destructive alike. */
    current: "border-current/30 border-t-current",
    /** No brand colour at all. Used by pull-to-refresh, which is deliberately
     *  distinct from the green spinner. */
    neutral: "border-secondary border-t-transparent",
};

export type SpinnerSize = keyof typeof sizes;
export type SpinnerTone = keyof typeof tones;

interface SpinnerProps {
    /** @default 'md' */
    size?: SpinnerSize;
    /** @default 'brand' */
    tone?: SpinnerTone;
    /**
     * Set false to freeze the ring so a caller can drive rotation itself —
     * pull-to-refresh rotates it by drag distance before the refresh starts.
     * @default true
     */
    spin?: boolean;
    className?: string;
}

/**
 * The ring itself. Decorative by default: it is hidden from assistive tech, so
 * whatever wraps it owns the announcement (a button keeps its label, and
 * `LoadingState` exposes a status role).
 */
export const Spinner = ({ size = "md", tone = "brand", spin = true, className }: SpinnerProps) => (
    <span
        aria-hidden="true"
        className={cx("block rounded-full border-2", sizes[size], tones[tone], spin && "animate-spin", className)}
    />
);

/**
 * How a full-area state fills whatever is loading, failing, or empty. Shared by
 * LoadingState, ErrorState and EmptyState so all three land in the same place.
 */
export const areaVariants = {
    /** Fills the viewport — for routes that render outside AppLayout. */
    screen: "min-h-dvh",
    /**
     * Fills the scroll container. AppLayout's <main> is a flex item with a
     * definite height but is not itself a flex column, so `flex-1` on a child
     * resolves to nothing and the loader collapses to the top. A percentage
     * min-height resolves against that definite height instead, which is what
     * actually centres it.
     */
    fill: "min-h-full",
    /**
     * Grows to fill the remaining space of a flex-column parent. Use where the
     * loading area sits below persistent chrome — an admin list under its
     * search and filter row — so the spinner centres in the part that is
     * actually loading rather than in the page as a whole. Every ancestor up to
     * the scroll container has to be a growing flex column for this to resolve;
     * `fill` does NOT work here, since a percentage min-height measured against
     * a padded flex parent lands well above centre.
     */
    grow: "flex-1",
    /** Centres within its own block — for a panel or sheet with no height to fill. */
    block: "py-16",
};

export type AreaVariant = keyof typeof areaVariants;

interface LoadingStateProps {
    /** @default 'fill' */
    variant?: AreaVariant;
    /** @default 'lg' */
    size?: SpinnerSize;
    /** Announced to screen readers while loading. @default 'Loading' */
    label?: string;
    className?: string;
}

/** A centred {@link Spinner} that fills whichever area is loading. */
export const LoadingState = ({ variant = "fill", size = "lg", label = "Loading", className }: LoadingStateProps) => (
    <div role="status" className={cx("flex w-full items-center justify-center", areaVariants[variant], className)}>
        <Spinner size={size} />
        <span className="sr-only">{label}</span>
    </div>
);
