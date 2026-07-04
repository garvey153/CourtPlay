import { memo, useEffect, useRef } from "react";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import type { FeedPost } from "@/types/feed";

export type CardKind =
    | "open"
    | "approved"
    | "claimed"
    | "pending"
    | "expired"
    | "filled"
    | "completed"
    | "cancelled"
    | "rejected"
    | "backed_out";

interface KindConfig {
    bar: string;
    label: string;
    badgeBg: string;
    badgeFg: string;
    dot: string | null; // null = solid badge, no dot
    dim: boolean;
}

const KIND_CONFIG: Record<CardKind, KindConfig> = {
    open: { bar: "bg-brand-500", label: "Open", badgeBg: "bg-brand-800", badgeFg: "text-brand-500", dot: "bg-brand-500", dim: false },
    approved: { bar: "bg-brand-500", label: "Approved", badgeBg: "bg-brand-800", badgeFg: "text-brand-500", dot: "bg-brand-500", dim: false },
    claimed: { bar: "bg-neutral-400", label: "Claimed", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", dot: "bg-neutral-400", dim: true },
    pending: { bar: "bg-neutral-400", label: "Pending", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", dot: "bg-neutral-400", dim: false },
    expired: { bar: "bg-red-500", label: "Expired", badgeBg: "bg-red-900", badgeFg: "text-red-400", dot: "bg-red-400", dim: true },
    filled: { bar: "bg-neutral-400", label: "Filled", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", dot: "bg-neutral-400", dim: true },
    completed: { bar: "bg-neutral-400", label: "Completed", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", dot: null, dim: true },
    cancelled: { bar: "bg-neutral-400", label: "Cancelled", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", dot: null, dim: true },
    rejected: { bar: "bg-red-500", label: "Declined", badgeBg: "bg-red-900", badgeFg: "text-red-400", dot: "bg-red-400", dim: true },
    backed_out: { bar: "bg-neutral-400", label: "Backed out", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", dot: null, dim: true },
};

function getCardKind(post: FeedPost): CardKind {
    if (post.status === "expired") return "expired";
    if (post.user_claim_status === "approved") return "approved";
    if (post.user_claim_status === "pending") return "pending";
    if (post.spots_available <= 0) return "claimed";
    return "open";
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/** "Sat 9:00am" — weekday + start time, matching the GameCard title. */
function formatWhen(gameDate: string | null, gameTime: string | null): string {
    const parts: string[] = [];
    if (gameDate) {
        const d = new Date(gameDate + "T12:00:00");
        parts.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    }
    if (gameTime) {
        const [h, m] = gameTime.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "pm" : "am";
        const h12 = hour % 12 || 12;
        parts.push(`${h12}:${m}${ampm}`);
    }
    return parts.join(" ");
}

function formatPlayType(playType: string | null): string {
    if (!playType) return "";
    return playType
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function formatDuration(duration: number | null): string | null {
    if (duration == null) return null;
    return duration === 1 ? "1 hr" : `${duration} hrs`;
}

interface SubCardProps {
    post: FeedPost;
    currentUserId?: string | null;
    onViewed?: (postId: string) => void;
    /** Tapping the card opens the claim-detail bottom sheet. */
    onOpenDetail?: (post: FeedPost) => void;
    /** Force the card state (Activity uses this from the claim/post display state). */
    kindOverride?: CardKind;
}

export const SubCard = memo(function SubCard({ post, currentUserId, onViewed, onOpenDetail, kindOverride }: SubCardProps) {
    const cardRef = useRef<HTMLButtonElement>(null);
    const didTrack = useRef(false);

    // Track a view once the card is half-visible (used for price-drop notifications).
    useEffect(() => {
        const el = cardRef.current;
        if (!el || didTrack.current || currentUserId === post.author_id) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !didTrack.current) {
                    didTrack.current = true;
                    onViewed?.(post.id);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [post.id, post.author_id, currentUserId, onViewed]);

    const kind = kindOverride ?? getCardKind(post);
    const config = KIND_CONFIG[kind];

    const playType = formatPlayType(post.play_type);
    const title = [playType, "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(post.game_date, post.game_time);

    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");

    const primaryText = config.dim ? "text-tertiary" : "text-primary";

    return (
        <button
            ref={cardRef}
            type="button"
            onClick={() => onOpenDetail?.(post)}
            className="flex w-full overflow-hidden rounded text-left"
        >
            {/* Left status accent bar */}
            <span className={cx("w-1 shrink-0 self-stretch", config.bar)} aria-hidden="true" />

            {/* Card body */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                {/* Top row: title/subtitle + status badge */}
                <div className="flex w-full items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className={cx("text-md font-semibold", primaryText)}>
                            {title}
                            {when && ` · ${when}`}
                        </p>
                        {subtitle && <p className={cx("text-xs", config.dim ? "text-tertiary" : "text-secondary")}>{subtitle}</p>}
                    </div>

                    {/* Status badge */}
                    <span
                        className={cx(
                            "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold",
                            config.badgeBg,
                            config.badgeFg,
                        )}
                    >
                        {config.dot && <span className={cx("size-1.5 rounded-full", config.dot)} aria-hidden="true" />}
                        {config.label}
                    </span>
                </div>

                {/* Poster row: avatar + name/time (+ friend) + price */}
                <div className="flex w-full items-center justify-between pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                            size="xs"
                            src={post.photo_url}
                            alt={post.first_name}
                            initials={post.first_name.charAt(0).toUpperCase()}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <span className="truncate text-xs text-tertiary">
                            {post.first_name} · {timeAgo(post.created_at)}
                        </span>
                        {post.is_friend && (
                            <span className="shrink-0 rounded-lg bg-blue-900 px-2 py-0.5 text-xs font-semibold text-blue-400">
                                Friend
                            </span>
                        )}
                    </div>
                    <span className={cx("shrink-0 text-sm font-semibold", primaryText)}>
                        {post.cost != null ? `$${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Free"}
                    </span>
                </div>

                {/* Notes speech-bubble (only when the poster added a note) */}
                {post.notes && (
                    <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}
            </div>
        </button>
    );
});
