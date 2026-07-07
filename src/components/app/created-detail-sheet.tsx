import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import type { ClaimRow, MyPost } from "@/types/activity";

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

interface CreatedDetailSheetProps {
    post: MyPost;
    /** The current user (post author) shown in the poster row. */
    poster: Poster;
    onClose: () => void;
    onApprove: (claim: ClaimRow) => void;
    onDecline: (claim: ClaimRow) => void;
    /** Open the post in the edit form (no-claim state). */
    onEdit: () => void;
    /** Delete the post (no-claim state). */
    onDelete: () => void;
    /** Claim id currently being approved/declined. */
    actionLoading?: string | null;
    /** Whether the post is currently being deleted. */
    deleting?: boolean;
}

/**
 * Creator's view of one of their posts (Created tab). When the post has a pending
 * claim it shows "Your post has been claimed!" with the claimant and Approve /
 * Decline. Matches design 274-4741.
 */
export function CreatedDetailSheet({ post, poster, onClose, onApprove, onDecline, onEdit, onDelete, actionLoading, deleting }: CreatedDetailSheetProps) {
    // Delete confirmation is shown inline in this same sheet (no close/reopen).
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Escape backs out of the confirmation first, then closes the sheet.
            if (e.key === "Escape") setConfirmingDelete((c) => (c ? false : (onClose(), false)));
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const pendingClaim = post.claims.find((c) => c.status === "pending");
    const approvedClaim = post.claims.find((c) => c.status === "approved");
    const claim = pendingClaim ?? approvedClaim ?? null;
    const busy = !!actionLoading && claim?.id === actionLoading;
    // Regular-play posts have no price, so the poster row omits it.
    const isRegular = post.post_type === "regular_game";

    const title = [formatPlayType(post.play_type, post.format), "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");
    const posterName = poster.last_name ? `${poster.first_name} ${poster.last_name.charAt(0).toUpperCase()}.` : poster.first_name;
    const priceLabel = post.cost != null ? `$${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Free";

    const banner = pendingClaim ? "Your post has been claimed!" : approvedClaim ? "Claim approved!" : null;

    // Once approved, the creator can charge the claimant via Venmo.
    const chargeHref =
        approvedClaim?.venmo_handle && post.cost != null
            ? `venmo://paycharge?txn=charge&recipients=${encodeURIComponent(approvedClaim.venmo_handle)}&amount=${post.cost.toFixed(2)}&note=${encodeURIComponent(`CourtPlay - ${court ?? "Tennis"}`)}`
            : null;
    const venmoWeb = approvedClaim?.venmo_handle ? `https://venmo.com/${encodeURIComponent(approvedClaim.venmo_handle)}` : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="created-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {confirmingDelete ? (
                    <>
                        {/* Delete confirmation — same sheet (design 274-5651) */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-col gap-1">
                                <h2 className="text-md font-semibold text-primary">Delete this post?</h2>
                                <p className="text-sm text-secondary">This will permanently remove it from the app.</p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                            >
                                <XClose className="size-5" />
                            </button>
                        </div>

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

                        <div className="mt-2 flex flex-col gap-3">
                            <button type="button" onClick={onDelete} disabled={deleting} className={PRIMARY_BTN}>
                                {deleting ? <ButtonSpinner /> : "Yes, delete"}
                            </button>
                            <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className={SECONDARY_BTN}>
                                No, keep it
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                {/* Header — status banner (when claimed) + close */}
                <div className="flex items-start justify-between gap-3">
                    {banner ? (
                        <p className="text-sm text-brand-500">{banner}</p>
                    ) : (
                        <div className="flex min-w-0 flex-col gap-1">
                            <h2 id="created-sheet-title" className="text-md font-semibold text-primary">
                                {title}
                                {when && ` · ${when}`}
                            </h2>
                            {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" />
                    </button>
                </div>

                {/* Title (below banner when claimed) */}
                {banner && (
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-md font-semibold text-primary">
                            {title}
                            {when && ` · ${when}`}
                        </h2>
                        {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
                    </div>
                )}

                {/* Poster (me) + price */}
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

                {/* Poster's note */}
                {post.notes && (
                    <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}

                {/* Claimant */}
                {claim && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Avatar
                                size="xs"
                                src={claim.photo_url}
                                alt={claim.first_name}
                                initials={claim.first_name.charAt(0).toUpperCase()}
                                className="shrink-0 bg-white p-px shadow-xs"
                            />
                            <span className="truncate text-xs text-tertiary">
                                {claim.first_name} {claim.last_name.charAt(0).toUpperCase()}. · {timeAgo(claim.created_at)}
                            </span>
                        </div>
                        {/* TODO: show the claimer's message once claims carry a message field
                            (needs a `message` column on claims + submit_claim to accept it). */}

                        {/* Claimant contact — revealed once approved */}
                        {approvedClaim && (claim.phone || claim.venmo_handle) && (
                            <div className="flex flex-col gap-0.5 text-sm text-tertiary">
                                {claim.phone && <p>Phone: {claim.phone}</p>}
                                {claim.venmo_handle && <p>Venmo: @{claim.venmo_handle}</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                {!claim ? (
                    // No claims yet — manage the post (design 271-4581). Extra top space
                    // separates the actions from the message, matching the design.
                    <div className="mt-4 flex flex-col gap-3">
                        <button type="button" onClick={onEdit} className={PRIMARY_BTN}>
                            Edit post
                        </button>
                        <button type="button" onClick={() => setConfirmingDelete(true)} className={SECONDARY_BTN}>
                            Delete post
                        </button>
                    </div>
                ) : pendingClaim ? (
                    <div className="flex flex-col gap-3">
                        <button type="button" onClick={() => onApprove(pendingClaim)} disabled={busy} className={PRIMARY_BTN}>
                            {busy ? <ButtonSpinner /> : "Approve claim"}
                        </button>
                        <button type="button" onClick={() => onDecline(pendingClaim)} disabled={busy} className={SECONDARY_BTN}>
                            Decline
                        </button>
                    </div>
                ) : approvedClaim ? (
                    <div className="flex flex-col gap-3">
                        {chargeHref ? (
                            <a href={chargeHref} className={PRIMARY_BTN}>
                                Request payment via Venmo
                            </a>
                        ) : (
                            <button type="button" onClick={onClose} className={PRIMARY_BTN}>
                                Done
                            </button>
                        )}
                        {venmoWeb && chargeHref && (
                            <a
                                href={venmoWeb}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-center text-xs text-tertiary underline underline-offset-2 hover:text-secondary"
                            >
                                Open Venmo on web instead
                            </a>
                        )}
                    </div>
                ) : null}
                    </>
                )}
            </motion.div>
        </div>
    );
}
