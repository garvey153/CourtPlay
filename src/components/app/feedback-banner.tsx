import { XClose } from "@untitledui/icons";

interface FeedbackBannerProps {
    count: number;
    /** Opens the admin dashboard (Reports → Feedback). */
    onView: () => void;
    onDismiss: () => void;
}

/**
 * Admin-only feed banner announcing new feedback submissions. Uses the shared
 * confirmation-banner styling (matches ClaimReceivedBanner / PushEnableBanner).
 */
export function FeedbackBanner({ count, onView, onDismiss }: FeedbackBannerProps) {
    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">
                {count === 1 ? "New feedback submitted" : `${count} new feedback submissions`}
            </p>
            <p className="mt-1 text-sm text-secondary">
                {count === 1 ? "A player shared feedback. Review it in the dashboard." : "Players shared feedback. Review it in the dashboard."}
            </p>

            <div className="mt-3 flex items-center gap-3">
                <button
                    type="button"
                    onClick={onDismiss}
                    className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Dismiss
                </button>
                <button
                    type="button"
                    onClick={onView}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                >
                    View feedback
                </button>
            </div>
        </div>
    );
}
