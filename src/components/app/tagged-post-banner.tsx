import { XClose } from "@untitledui/icons";
import type { TaggedPost } from "@/types/feed";
import { formatPlayType, formatWhen } from "./sub-card";

interface TaggedPostBannerProps {
    post: TaggedPost;
    kind: "claimed" | "approved";
    onDismiss: () => void;
    /** Opens the tagged sheet for the post. */
    onView: () => void;
}

/**
 * Top-of-feed notice that a sub for YOUR group's game has been claimed, and
 * again when the poster approves it.
 *
 * The in-app half of the three tagged notifications — push and email are the
 * other two. Derived from get_my_tagged_posts rather than an events table,
 * following the same idiom as GroupBanner: the claim row IS the event record,
 * so its status is enough to say which of the two notices to show.
 */
export function TaggedPostBanner({ post, kind, onDismiss, onView }: TaggedPostBannerProps) {
    const playType = formatPlayType(post.play_type ?? post.format);
    // "Doubles · Fri 9:00am". Built as a proper noun phrase rather than
    // lowercased into a sentence — formatWhen returns a capitalised weekday, and
    // lowercasing the whole string turned it into "fri".
    const game = [playType || "your game", formatWhen(post.game_date, post.game_time)]
        .filter(Boolean)
        .join(" · ");
    const claimer = post.claimer_first_name ?? "Someone";

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
                {kind === "approved" ? "Your sub is confirmed" : "Someone claimed your group's spot"}
            </p>
            <p className="mt-1 text-sm text-secondary">
                {kind === "approved"
                    ? `${claimer} is filling the spot in your ${game} game${
                          post.group_name ? ` with ${post.group_name}` : ""
                      }.`
                    : `${claimer} claimed the spot ${post.poster_first_name} posted for your ${game} game. Waiting on approval.`}
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
                    View post
                </button>
            </div>
        </div>
    );
}
