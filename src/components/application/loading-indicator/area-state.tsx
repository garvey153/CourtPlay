import type { ReactNode } from "react";
import { Link } from "react-router";
import { areaVariants, type AreaVariant } from "./spinner";
import { cx } from "@/utils/cx";

/**
 * The states that replace a whole area's content: it failed, or there is
 * nothing to show. They share {@link areaVariants} with LoadingState so all
 * three land in the same place — swapping between them never moves the content.
 */

// Matches the CTA used across the feed and post pages.
const PRIMARY_ACTION =
    "rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:bg-brand-solid_hover";
const SECONDARY_ACTION =
    "rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800";

const shell = (variant: AreaVariant, className?: string) =>
    cx("flex w-full flex-col items-center justify-center gap-3 px-4 text-center", areaVariants[variant], className);

interface ErrorStateProps {
    /** @default 'fill' */
    variant?: AreaVariant;
    /** @default 'Something went wrong' */
    title?: string;
    /** The underlying failure, shown beneath the title. */
    message?: string | null;
    /** Renders a retry control when provided. */
    onRetry?: () => void;
    /** @default 'Retry' */
    retryLabel?: string;
    className?: string;
}

/** Shown when an area's content failed to load. */
export const ErrorState = ({
    variant = "fill",
    title = "Something went wrong",
    message,
    onRetry,
    retryLabel = "Retry",
    className,
}: ErrorStateProps) => (
    <div role="alert" className={shell(variant, className)}>
        <p className="text-base font-semibold text-primary">{title}</p>
        {message && <p className="text-sm text-tertiary">{message}</p>}
        {onRetry && (
            <button type="button" onClick={onRetry} className={cx("mt-1", PRIMARY_ACTION)}>
                {retryLabel}
            </button>
        )}
    </div>
);

interface EmptyStateProps {
    /** @default 'fill' */
    variant?: AreaVariant;
    title: string;
    /** Optional supporting line under the title. */
    description?: ReactNode;
    /** Label for the call to action. Requires onAction or href. */
    actionLabel?: string;
    onAction?: () => void;
    /** Renders the call to action as a router link instead of a button. */
    href?: string;
    /** @default 'primary' */
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
    actionTone = "primary",
    className,
}: EmptyStateProps) => {
    const actionClass = cx("mt-1", actionTone === "primary" ? PRIMARY_ACTION : SECONDARY_ACTION);

    return (
        <div className={shell(variant, className)}>
            <p className="text-base font-semibold text-primary">{title}</p>
            {description && <p className="text-sm text-tertiary">{description}</p>}
            {actionLabel && href && (
                <Link to={href} className={actionClass}>
                    {actionLabel}
                </Link>
            )}
            {actionLabel && !href && onAction && (
                <button type="button" onClick={onAction} className={actionClass}>
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
