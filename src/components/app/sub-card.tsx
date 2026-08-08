import { memo, useEffect, useRef } from "react";
import { Avatar } from "@/components/base/avatar/avatar";
import { FriendBadge } from "./friend-badge";
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
    /** bg-* twin of badgeFg — the Friend badge is knocked out of this colour. */
    accent: string;
    dot: string | null; // null = solid badge, no dot
    dim: boolean;
}

export const KIND_CONFIG: Record<CardKind, KindConfig> = {
    open: { bar: "bg-brand-500", label: "Open", badgeBg: "bg-brand-800", badgeFg: "text-brand-500", accent: "bg-brand-500", dot: "bg-brand-500", dim: false },
    approved: { bar: "bg-brand-500", label: "Approved", badgeBg: "bg-brand-800", badgeFg: "text-brand-500", accent: "bg-brand-500", dot: "bg-brand-500", dim: false },
    claimed: { bar: "bg-neutral-400", label: "Claimed", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", accent: "bg-neutral-400", dot: "bg-neutral-400", dim: true },
    pending: { bar: "bg-neutral-400", label: "Pending", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", accent: "bg-neutral-400", dot: "bg-neutral-400", dim: false },
    expired: { bar: "bg-red-500", label: "Expired", badgeBg: "bg-red-900", badgeFg: "text-red-400", accent: "bg-red-400", dot: "bg-red-400", dim: true },
    filled: { bar: "bg-neutral-400", label: "Filled", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", accent: "bg-neutral-400", dot: "bg-neutral-400", dim: true },
    completed: { bar: "bg-neutral-400", label: "Completed", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", accent: "bg-neutral-400", dot: null, dim: true },
    cancelled: { bar: "bg-neutral-400", label: "Cancelled", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", accent: "bg-neutral-400", dot: null, dim: true },
    rejected: { bar: "bg-red-500", label: "Declined", badgeBg: "bg-red-900", badgeFg: "text-red-400", accent: "bg-red-400", dot: "bg-red-400", dim: true },
    backed_out: { bar: "bg-neutral-400", label: "Backed out", badgeBg: "bg-neutral-800", badgeFg: "text-neutral-400", accent: "bg-neutral-400", dot: null, dim: true },
};

/** Epoch ms of a dated post's end (game date + time). Null for undated posts. */
export function gameEndMs(post: Pick<FeedPost, "game_date" | "game_time">): number | null {
    if (!post.game_date) return null;
    // game_time comes from Postgres as "HH:MM:SS"; keep just HH:MM so the ISO
    // string stays valid ("…THH:MM:00"). Fall back to null on any parse failure
    // so a bad value never drops the post from the feed.
    const time = (post.game_time ?? "23:59").slice(0, 5);
    const ms = new Date(`${post.game_date}T${time}:00`).getTime();
    return Number.isNaN(ms) ? null : ms;
}

function getCardKind(post: FeedPost): CardKind {
    // The viewer's own claim takes precedence so their card reflects their state.
    if (post.user_claim_status === "approved") return "approved";
    if (post.user_claim_status === "pending") return "pending";
    // A filled spot stays "Claimed" even once the game date/time has passed.
    if (post.spots_available <= 0) return "claimed";
    // An unclaimed post whose game date/time has passed is "Expired".
    const end = gameEndMs(post);
    if (post.status === "expired" || (end !== null && end < Date.now())) return "expired";
    return "open";
}

export function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/** "Sat 9:00am" — weekday + start time, matching the GameCard title. */
export function formatWhen(gameDate: string | null, gameTime: string | null): string {
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

export function formatPlayType(playType: string | null): string {
    if (!playType) return "";
    return playType
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

export function formatDuration(duration: number | null): string | null {
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
    /**
     * Badge text, when it differs from the kind's own label. The kind still
     * picks the colours — this only renames what the badge says.
     *
     * Created posts need it: an approved claim leaves the poster's spot gone,
     * so the card wears the Claimed treatment, but "Claimed" is not the event
     * that happened. Same split the admin cards already make, where
     * adminCardKind returns a kind and a label separately.
     */
    labelOverride?: string;
}

export const SubCard = memo(function SubCard({ post, currentUserId, onViewed, onOpenDetail, kindOverride, labelOverride }: SubCardProps) {
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

    // You're in the group this sub is playing with. The card steps back: darker
    // bar, text one shade quieter, and the price replaced by a two-person mark,
    // because the spot isn't yours to take and the money isn't yours to pay.
    //
    // Applied on top of whatever status the post is in rather than as another
    // KIND_CONFIG entry — the badge still needs to say Open or Claimed, which is
    // information a player in the game wants. Only the acting affordances go.
    const isTagged = post.is_tagged;

    // Expired posts are dead — tapping them opens nothing.
    const isExpired = kind === "expired";

    const playType = formatPlayType(post.play_type);
    const title = [playType, "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(post.game_date, post.game_time);

    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");

    const primaryText = config.dim ? "text-tertiary" : "text-primary";
    // A tagged card's TITLE sits one step back, at secondary.
    const taggedText = isTagged && !config.dim ? "text-secondary" : primaryText;
    // Its PRICE goes a step further, to the tertiary a claimed card uses: the
    // money isn't this viewer's to pay, so it reads the same as a spot already
    // settled rather than one still being offered.
    const priceText = isTagged ? "text-tertiary" : primaryText;

    return (
        <button
            ref={cardRef}
            type="button"
            onClick={isExpired ? undefined : () => onOpenDetail?.(post)}
            aria-disabled={isExpired || undefined}
            className={cx("flex w-full overflow-hidden rounded text-left", isExpired && "cursor-default")}
        >
            {/* Left status accent bar */}
            <span className={cx("w-1 shrink-0 self-stretch", isTagged ? "bg-brand-800" : config.bar)} aria-hidden="true" />

            {/* Card body */}
            <div
                className={cx(
                    "flex min-w-0 flex-1 flex-col gap-3 bg-secondary p-4 transition duration-100 ease-linear",
                    !isExpired && "hover:bg-secondary_hover",
                )}
            >
                {/* Top row: title/subtitle + status badge */}
                <div className="flex w-full items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className={cx("text-md font-semibold", taggedText)}>
                            {title}
                            {when && ` · ${when}`}
                        </p>
                        {subtitle && <p className={cx("text-xs", config.dim || isTagged ? "text-tertiary" : "text-secondary")}>{subtitle}</p>}
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
                        {labelOverride ?? config.label}
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
                            {/* The group name sits between poster and time on a
                                tagged card — it is the reason this post is in
                                your feed, so it belongs in the byline rather
                                than needing the sheet to explain it. */}
                            {[post.first_name, isTagged ? post.tagged_group_name : null, timeAgo(post.created_at)]
                                .filter(Boolean)
                                .join(" · ")}
                        </span>
                        {post.is_friend && <FriendBadge accent={config.accent} />}
                    </div>
                    <span className={cx("shrink-0 text-sm font-semibold", priceText)}>
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
