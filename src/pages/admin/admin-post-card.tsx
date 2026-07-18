import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { KIND_CONFIG, type CardKind, gameEndMs, formatWhen, formatPlayType, formatDuration, timeAgo } from "@/components/app/sub-card";

/** Flat shape the admin posts tab feeds each card. Derived from the `posts` row. */
export interface AdminPostRow {
    id: string;
    play_type: string | null;
    format: string | null;
    game_date: string | null;
    game_time: string | null;
    skill_level: string | null;
    duration: number | null;
    location: string | null;
    custom_court: string | null;
    court_id: string | null;
    cost: number | null;
    /** posts.status — 'active' | 'expired' | 'deleted'. */
    status: string;
    /** spots_total minus open (pending/approved) claims. <= 0 means filled. */
    spots_available: number;
    notes: string | null;
    created_at: string;
    author_first_name: string;
    author_photo_url: string | null;
}

/**
 * Map an admin post row to a feed-card kind + badge label. Unlike the feed
 * (which hides claimed/expired detail from the viewer), admin surfaces the real
 * lifecycle: deleted posts get their own dimmed "Deleted" badge.
 */
export function adminCardKind(post: AdminPostRow): { kind: CardKind; label: string } {
    if (post.status === "deleted") return { kind: "cancelled", label: "Deleted" };
    const end = gameEndMs(post);
    const isPast = end !== null && end < Date.now();
    if (post.status === "expired" || isPast) return { kind: "expired", label: "Expired" };
    if (post.spots_available <= 0) return { kind: "claimed", label: "Claimed" };
    return { kind: "open", label: "Open" };
}

interface AdminPostCardProps {
    post: AdminPostRow;
    /** Tapping the card opens the admin detail/actions sheet. */
    onOpen: (post: AdminPostRow) => void;
}

/**
 * Feed-style post card for the admin Posts tab. Mirrors SubCard's visual, but is
 * always tappable — admins act on expired and deleted posts too.
 */
export function AdminPostCard({ post, onOpen }: AdminPostCardProps) {
    const { kind, label } = adminCardKind(post);
    const config = KIND_CONFIG[kind];

    const title = [formatPlayType(post.play_type), "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(post.game_date, post.game_time);

    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");

    const primaryText = config.dim ? "text-tertiary" : "text-primary";

    return (
        <button
            type="button"
            onClick={() => onOpen(post)}
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
                        {label}
                    </span>
                </div>

                {/* Poster row: avatar + name/time + price */}
                <div className="flex w-full items-center justify-between pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                            size="xs"
                            src={post.author_photo_url}
                            alt={post.author_first_name}
                            initials={post.author_first_name.charAt(0).toUpperCase()}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <span className="truncate text-xs text-tertiary">
                            {post.author_first_name} · {timeAgo(post.created_at)}
                        </span>
                    </div>
                    <span className={cx("shrink-0 text-sm font-semibold", primaryText)}>
                        {post.cost ? `$${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Free"}
                    </span>
                </div>
            </div>
        </button>
    );
}
