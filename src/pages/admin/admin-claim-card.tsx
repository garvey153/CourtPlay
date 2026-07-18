import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { KIND_CONFIG, type CardKind, formatWhen, formatPlayType, formatDuration, timeAgo } from "@/components/app/sub-card";

/** Flat shape the admin claims tab feeds each card. A claim joined to its post + claimer. */
export interface AdminClaimRow {
    id: string;
    status: string; // pending | approved | rejected | unclaimed | cancelled
    created_at: string;
    claimer_id: string;
    post_id: string;
    post_author_id: string | null;
    // Post (game) details
    play_type: string | null;
    format: string | null;
    game_date: string | null;
    game_time: string | null;
    skill_level: string | null;
    duration: number | null;
    location: string | null;
    custom_court: string | null;
    cost: number | null;
    // Claimer
    claimer_first_name: string | null;
    claimer_last_name: string | null;
    claimer_email: string | null;
    claimer_photo_url: string | null;
    // Poster responsiveness (avg seconds to respond), if known
    poster_avg_response_seconds: number | null;
}

/** Map a claim's status to a feed-card kind + badge label. */
export function claimKind(status: string): { kind: CardKind; label: string } {
    switch (status) {
        case "approved":
            return { kind: "approved", label: "Approved" };
        case "rejected":
            return { kind: "rejected", label: "Rejected" };
        case "cancelled":
            return { kind: "cancelled", label: "Cancelled" };
        case "unclaimed":
            return { kind: "cancelled", label: "Unclaimed" };
        default:
            return { kind: "pending", label: "Pending" };
    }
}

/** "Chris B." — claimer first name + last initial. */
export function claimerName(claim: Pick<AdminClaimRow, "claimer_first_name" | "claimer_last_name" | "claimer_email">): string {
    if (!claim.claimer_first_name) return claim.claimer_email ?? "Unknown";
    const last = claim.claimer_last_name ? ` ${claim.claimer_last_name.charAt(0).toUpperCase()}.` : "";
    return `${claim.claimer_first_name}${last}`;
}

interface AdminClaimCardProps {
    claim: AdminClaimRow;
    onOpen: (claim: AdminClaimRow) => void;
}

/** Feed-style claim card for the admin Claims tab (design 347:5733). */
export function AdminClaimCard({ claim, onOpen }: AdminClaimCardProps) {
    const { kind, label } = claimKind(claim.status);
    const config = KIND_CONFIG[kind];

    const title = [formatPlayType(claim.play_type), "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(claim.game_date, claim.game_time);

    const court = claim.location ?? claim.custom_court;
    const subtitle = [court, claim.skill_level ? `NTRP ${claim.skill_level}` : null, formatDuration(claim.duration)]
        .filter(Boolean)
        .join(" · ");

    const primaryText = config.dim ? "text-tertiary" : "text-primary";
    const name = claimerName(claim);

    return (
        <button
            type="button"
            onClick={() => onOpen(claim)}
            className="flex w-full overflow-hidden rounded text-left"
        >
            {/* Left status accent bar */}
            <span className={cx("w-1 shrink-0 self-stretch", config.bar)} aria-hidden="true" />

            {/* Card body */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                {/* Top row: game info + status badge */}
                <div className="flex w-full items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className={cx("text-md font-semibold", primaryText)}>
                            {title}
                            {when && ` · ${when}`}
                        </p>
                        {subtitle && <p className={cx("text-xs", config.dim ? "text-tertiary" : "text-secondary")}>{subtitle}</p>}
                    </div>
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

                {/* Claimer row: avatar + name/time + price */}
                <div className="flex w-full items-center justify-between pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                            size="xs"
                            src={claim.claimer_photo_url}
                            alt={name}
                            initials={(claim.claimer_first_name ?? claim.claimer_email ?? "?").charAt(0).toUpperCase()}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <span className="truncate text-xs text-tertiary">
                            {name} · {timeAgo(claim.created_at)}
                        </span>
                    </div>
                    <span className={cx("shrink-0 text-sm font-semibold", primaryText)}>
                        {claim.cost != null ? `$${claim.cost % 1 === 0 ? claim.cost : claim.cost.toFixed(2)}` : "Free"}
                    </span>
                </div>
            </div>
        </button>
    );
}
