import type { ReactNode } from "react";
import { Link } from "react-router";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/components/base/buttons/cta";
import { describeLoadError } from "@/utils/load-error";
import { areaVariants, type AreaVariant } from "./spinner";
import { cx } from "@/utils/cx";

/**
 * The states that replace a whole area's content: it failed, or there is
 * nothing to show. They share {@link areaVariants} with LoadingState so all
 * three land in the same place — swapping between them never moves the content.
 *
 * An empty state's call to action is the SECONDARY button (Figma 32:542): there
 * is nothing here, so the invitation to go make something is an offer rather
 * than the obvious next step. ErrorState's retry stays primary — a failed load
 * has exactly one thing worth doing.
 *
 * Set as the default rather than passed at each of the eleven call sites, none
 * of which had an opinion. A page that genuinely needs the loud one can still
 * say actionTone="primary".
 */

const shell = (variant: AreaVariant, className?: string) =>
    cx("flex w-full flex-col items-center justify-center gap-3 px-4 text-center", areaVariants[variant], className);

interface ErrorStateProps {
    /** @default 'fill' */
    variant?: AreaVariant;
    /**
     * The failure itself. Copy is derived from it, so a dropped connection reads
     * as such instead of leaking "TypeError: Load failed" or a Postgres code.
     * Log the underlying error rather than displaying it.
     */
    error?: unknown;
    /** What failed to load, mid-sentence: "the feed", "your activity". */
    subject?: string;
    /** Overrides the derived title — for a definitive result like "User not found". */
    title?: string;
    /** Overrides the derived message. */
    message?: string;
    /** Renders a retry control when provided. */
    onRetry?: () => void;
    /** @default 'Try again' */
    retryLabel?: string;
    className?: string;
}

/** Shown when an area's content failed to load. */
export const ErrorState = ({
    variant = "fill",
    error,
    subject,
    title,
    message,
    onRetry,
    retryLabel = "Try again",
    className,
}: ErrorStateProps) => {
    const derived = describeLoadError(error, subject);

    return (
        <div role="alert" className={shell(variant, className)}>
            <p className="text-base font-semibold text-primary">{title ?? derived.title}</p>
            <p className="text-sm text-tertiary">{message ?? derived.message}</p>
            {onRetry && (
                <button type="button" onClick={onRetry} className={cx("mt-1", PRIMARY_CTA)}>
                    {retryLabel}
                </button>
            )}
        </div>
    );
};

interface EmptyStateProps {
    /** @default 'fill' */
    variant?: AreaVariant;
    title: string;
    /** Optional supporting line under the title. */
    description?: ReactNode;
    /** Label for the call to action. Requires onAction or href. */
    actionLabel?: string;
    onAction?: () => void;
    /** Renders the call to action as a link instead of a button. */
    href?: string;
    /** @default 'secondary' */
    actionTone?: "primary" | "secondary";
    className?: string;
}

/** Shown when an area loaded successfully but has nothing to display. */
export const EmptyState = ({
    variant = "fill",
    title,
    description,
    actionLabel,
    onAction,
    href,
    actionTone = "secondary",
    className,
}: EmptyStateProps) => (
    <div className={shell(variant, className)}>
        <p className="text-base font-semibold text-primary">{title}</p>
        {description && <p className="text-sm text-tertiary">{description}</p>}
        {actionLabel && href && (
            <Link to={href} className={cx("mt-1", actionTone === "primary" ? PRIMARY_CTA : SECONDARY_CTA)}>
                {actionLabel}
            </Link>
        )}
        {actionLabel && !href && onAction && (
            <button
                type="button"
                onClick={onAction}
                className={cx("mt-1", actionTone === "primary" ? PRIMARY_CTA : SECONDARY_CTA)}
            >
                {actionLabel}
            </button>
        )}
    </div>
);
