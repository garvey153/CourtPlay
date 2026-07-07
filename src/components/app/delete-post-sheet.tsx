import { useEffect } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import type { MyPost } from "@/types/activity";

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function formatWhen(gameDate: string | null, gameTime: string | null): string {
    const parts: string[] = [];
    if (gameDate) parts.push(new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }));
    if (gameTime) {
        const [h, m] = gameTime.split(":");
        const hour = parseInt(h, 10);
        parts.push(`${hour % 12 || 12}:${m}${hour >= 12 ? "pm" : "am"}`);
    }
    return parts.join(" ");
}

function formatPlayType(playType: string | null, format: string | null): string {
    const value = playType ?? format;
    if (!value) return "";
    return value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatDuration(duration: number | null): string | null {
    if (duration == null) return null;
    return duration === 1 ? "1 hr" : `${duration} hrs`;
}

const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

interface Poster {
    first_name: string;
    last_name: string;
    photo_url: string | null;
}

interface DeletePostSheetProps {
    post: MyPost;
    poster: Poster;
    /** Confirm deletion. */
    onConfirm: () => void;
    /** Dismiss without deleting. */
    onCancel: () => void;
    /** Whether the delete is in flight. */
    deleting?: boolean;
}

/** Confirmation before deleting a post (design 274-5651). */
export function DeletePostSheet({ post, poster, onConfirm, onCancel, deleting }: DeletePostSheetProps) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onCancel]);

    const isRegular = post.post_type === "regular_game";
    const title = [formatPlayType(post.play_type, post.format), "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");
    const posterName = poster.last_name ? `${poster.first_name} ${poster.last_name.charAt(0).toUpperCase()}.` : poster.first_name;
    const priceLabel = post.cost != null ? `$${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Free";

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 id="delete-sheet-title" className="text-md font-semibold text-primary">
                            Delete this post?
                        </h2>
                        <p className="text-sm text-secondary">This will permanently remove it from the app.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" />
                    </button>
                </div>

                {/* Post card */}
                <div className="flex flex-col gap-3 rounded-lg border border-neutral-600 p-4">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-md font-semibold text-primary">
                            {title}
                            {when && ` · ${when}`}
                        </p>
                        {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <Avatar
                                size="xs"
                                src={poster.photo_url}
                                alt={poster.first_name}
                                initials={poster.first_name.charAt(0).toUpperCase()}
                                className="shrink-0 bg-white p-px shadow-xs"
                            />
                            <span className="truncate text-xs text-tertiary">
                                {posterName} · {timeAgo(post.created_at)}
                            </span>
                        </div>
                        {!isRegular && <span className="shrink-0 text-sm font-semibold text-primary">{priceLabel}</span>}
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={onConfirm} disabled={deleting} className={PRIMARY_BTN}>
                        {deleting ? <ButtonSpinner /> : "Yes, delete"}
                    </button>
                    <button type="button" onClick={onCancel} disabled={deleting} className={SECONDARY_BTN}>
                        No, keep it
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
