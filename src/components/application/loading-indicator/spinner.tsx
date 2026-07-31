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

const variants = {
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
    /** Centres within its own block — for a list or panel inside a page. */
    block: "py-16",
};

interface LoadingStateProps {
    /** @default 'fill' */
    variant?: keyof typeof variants;
    /** @default 'lg' */
    size?: SpinnerSize;
    /** Announced to screen readers while loading. @default 'Loading' */
    label?: string;
    className?: string;
}

/** A centred {@link Spinner} that fills whichever area is loading. */
export const LoadingState = ({ variant = "fill", size = "lg", label = "Loading", className }: LoadingStateProps) => (
    <div role="status" className={cx("flex w-full items-center justify-center", variants[variant], className)}>
        <Spinner size={size} />
        <span className="sr-only">{label}</span>
    </div>
);
