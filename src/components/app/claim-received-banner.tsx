import { X } from "@untitledui/icons";
import type { MyPost } from "@/types/activity";

function formatWhen(gameDate: string | null, gameTime: string | null): string {
    const parts: string[] = [];
    if (gameDate) parts.push(new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }));
    if (gameTime) {
        const [h, m] = gameTime.split(":");
        const hour = parseInt(h, 10);
        parts.push(`${hour % 12 || 12}:${m}${hour >= 12 ? "pm" : "am"}`);
    }
    return parts.join(" ");
}

interface ClaimReceivedBannerProps {
    post: MyPost;
    onDismiss: () => void;
    /** Opens the created-post detail sheet to review the claim. */
    onView: () => void;
}

/** Shown at the top of the feed when someone claims one of the viewer's posts. */
export function ClaimReceivedBanner({ post, onDismiss, onView }: ClaimReceivedBannerProps) {
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const where = [when && `on ${when}`, court && `at ${court}`].filter(Boolean).join(" ");

    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <X className="size-4" aria-hidden="true" />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">Waiting for approval!</p>
            <p className="mt-1 text-sm text-secondary">
                Your spot{where ? ` ${where}` : ""} has been claimed!
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
                    View claim
                </button>
            </div>
        </div>
    );
}
