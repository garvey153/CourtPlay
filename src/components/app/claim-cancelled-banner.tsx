import { X } from "@untitledui/icons";
import type { FeedPost } from "@/types/feed";

function formatWhen(gameDate: string | null, gameTime: string | null): string {
    const parts: string[] = [];
    if (gameDate) {
        parts.push(new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }));
    }
    if (gameTime) {
        const [h, m] = gameTime.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "pm" : "am";
        parts.push(`${hour % 12 || 12}:${m}${ampm}`);
    }
    return parts.join(" ");
}

interface ClaimCancelledBannerProps {
    post: FeedPost;
    onDismiss: () => void;
    /** Reopens the post's detail sheet in the open (claimable) state. */
    onUndo: () => void;
}

/** Confirmation banner shown at the top of the feed after a claim is cancelled. */
export function ClaimCancelledBanner({ post, onDismiss, onUndo }: ClaimCancelledBannerProps) {
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const details = [when, court].filter(Boolean).join(" at ");

    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <X className="size-4" />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">Cancellation successful!</p>
            <p className="mt-1 text-sm text-secondary">
                The spot{details ? ` on ${details}` : ""} is now reopened.
            </p>

            <div className="mt-3 flex items-center gap-6">
                <button
                    type="button"
                    onClick={onDismiss}
                    className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Dismiss
                </button>
                <button
                    type="button"
                    onClick={onUndo}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                >
                    Undo
                </button>
            </div>
        </div>
    );
}
