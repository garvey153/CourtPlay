import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { useShare } from "@/hooks/use-share";
import type { FeedPost } from "@/types/feed";
import { ShareModal } from "./share-modal";
import { ReportModal } from "./report-modal";

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

function formatDateLong(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime12(timeStr: string): string {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
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

// Bottom-sheet button styles, kept in sync with the feed filters sheet (brand
// primary with dark on-brand text; tertiary secondary) so all sheets match.
const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

/** Spinner tuned for the brand button (dark strokes on green). */
const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

interface ClaimDetailSheetProps {
    post: FeedPost;
    currentUserId?: string | null;
    onClose: () => void;
    /** Called after a successful claim so the feed can refresh. */
    onClaimed?: (claimId: string) => void;
}

export function ClaimDetailSheet({ post, currentUserId, onClose, onClaimed }: ClaimDetailSheetProps) {
    const [loading, setLoading] = useState(false);
    const [conflict, setConflict] = useState<{ date: string; time: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notifyState, setNotifyState] = useState<"idle" | "loading" | "done">(post.user_notify_me ? "done" : "idle");
    const [showReport, setShowReport] = useState(false);
    const { shareData, handleShare, closeShareModal } = useShare();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const isOwnPost = currentUserId === post.author_id;
    const activeClaim = post.user_claim_status === "pending" || post.user_claim_status === "approved";
    const isFull = post.spots_available <= 0;
    const isExpired = post.status === "expired";

    const handleClaim = useCallback(async () => {
        setLoading(true);
        setError(null);
        setConflict(null);

        const { data, error: rpcError } = await supabase.rpc("submit_claim", { p_post_id: post.id });
        setLoading(false);

        if (rpcError) {
            setError("Something went wrong. Please try again.");
            return;
        }
        if (!data.success) {
            if (data.conflict) {
                setConflict({ date: data.conflict_date, time: data.conflict_time });
            } else {
                setError(data.error ?? "Could not claim this spot.");
            }
            return;
        }

        sendNotification({
            user_id: post.author_id,
            notification_type: "claim_submitted",
            post_id: post.id,
            claim_id: data.claim_id as string,
        });
        onClaimed?.(data.claim_id as string);
    }, [post.id, post.author_id, onClaimed]);

    const handleNotifyMe = useCallback(async () => {
        if (notifyState !== "idle") return;
        setNotifyState("loading");
        await supabase.rpc("add_notify_me", { p_post_id: post.id });
        setNotifyState("done");
    }, [post.id, notifyState]);

    const playType = formatPlayType(post.play_type);
    const title = [playType, "Tennis"].filter(Boolean).join(" ");
    const posterName = post.last_name ? `${post.first_name} ${post.last_name}.` : post.first_name;
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");
    const costLabel = post.cost != null ? `Claim for $${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Claim spot";

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 id="claim-sheet-title" className="text-md font-semibold text-primary">
                            {title}
                            {when && ` · ${when}`}
                        </h2>
                        {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
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

                {/* Poster */}
                <div className="flex items-center gap-2">
                    <Avatar
                        size="xs"
                        src={post.photo_url}
                        alt={post.first_name}
                        initials={post.first_name.charAt(0).toUpperCase()}
                        className="shrink-0 bg-white p-px shadow-xs"
                    />
                    <span className="text-xs text-tertiary">
                        {posterName} · {timeAgo(post.created_at)}
                    </span>
                </div>

                {/* Notes */}
                {post.notes && (
                    <div className="w-full rounded-lg border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}

                {/* Conflict / error */}
                {conflict && (
                    <div className="rounded-lg bg-warning-primary p-3 text-sm text-primary">
                        You already have a pending claim on{" "}
                        <span className="font-semibold">{formatDateLong(conflict.date)}</span> at{" "}
                        <span className="font-semibold">{formatTime12(conflict.time)}</span>. Back out of that claim first.
                    </div>
                )}
                {error && <p className="text-sm text-error-primary">{error}</p>}

                {/* Helper text — only when a claim is possible. The "Report claim" link
                    lives inline here (same style/placement) and replaces the old
                    standalone "Report this post" link. */}
                {!isOwnPost && !activeClaim && !isFull && !isExpired && (
                    <p className="text-xs text-tertiary">
                        * Your claim will be sent to {post.first_name} for approval. You'll be notified once approved.
                        {currentUserId && (
                            <>
                                {" "}
                                Have an issue?{" "}
                                <button
                                    type="button"
                                    onClick={() => setShowReport(true)}
                                    className="text-tertiary underline underline-offset-2 transition duration-100 ease-linear hover:text-secondary"
                                >
                                    Report claim
                                </button>
                            </>
                        )}
                    </p>
                )}

                {/* Primary action */}
                <div className="flex flex-col gap-3">
                    {isOwnPost ? (
                        <p className="text-center text-sm text-tertiary">This is your post.</p>
                    ) : activeClaim ? (
                        <p className="text-center text-sm text-tertiary">
                            {post.user_claim_status === "pending"
                                ? "Awaiting poster approval"
                                : "Your spot is approved — check My Activity for details."}
                        </p>
                    ) : isExpired ? (
                        <p className="text-center text-sm text-tertiary">This post has expired.</p>
                    ) : isFull ? (
                        notifyState === "done" ? (
                            <p className="text-center text-sm text-success-primary">We'll notify you if a spot opens up.</p>
                        ) : (
                            <button
                                type="button"
                                onClick={handleNotifyMe}
                                disabled={notifyState === "loading"}
                                className={PRIMARY_BTN}
                            >
                                {notifyState === "loading" ? <ButtonSpinner /> : "Notify me if a spot opens"}
                            </button>
                        )
                    ) : (
                        <button
                            type="button"
                            onClick={handleClaim}
                            disabled={loading || !!conflict}
                            className={PRIMARY_BTN}
                        >
                            {loading ? <ButtonSpinner /> : costLabel}
                        </button>
                    )}

                    <button type="button" onClick={() => handleShare(post)} className={SECONDARY_BTN}>
                        Share with a friend
                    </button>
                </div>

            </motion.div>

            {shareData && <ShareModal url={shareData.url} text={shareData.text} onClose={closeShareModal} />}
            {showReport && <ReportModal targetType="post" targetId={post.id} onClose={() => setShowReport(false)} />}
        </div>
    );
}
