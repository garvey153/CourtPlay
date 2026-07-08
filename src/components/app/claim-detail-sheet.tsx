import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowCircleRight, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { useShare } from "@/hooks/use-share";
import type { FeedPost } from "@/types/feed";
import type { ClaimMessage } from "@/types/activity";
import { ShareModal } from "./share-modal";
import { ReportModal } from "./report-modal";
import { ThreadMessage } from "./thread-message";

const MESSAGE_MAX = 150;

// Friendly default replies — one is picked at random and used as the placeholder
// and, if the claimer doesn't type anything, sent as their message. Written to read
// naturally after "Hey {name}, ".
const DEFAULT_REPLIES = [
    "let's do this!",
    "count me in!",
    "I'd love to grab this spot!",
    "happy to sub in for you!",
    "looking forward to it!",
];

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
    /** Called after the claim state changes (claim or cancel) so the feed can refresh. */
    onClaimChange?: () => void;
    /** Called after a claim is cancelled (feed shows the "reopened" banner + closes). */
    onCancelled?: (post: FeedPost) => void;
    /** Poster contact, shown once the claim is approved (Activity → Claimed → Approved). */
    contact?: { venmoHandle: string | null; phone: string | null };
    /** Existing thread on this claim (claimer view) — shown indented under the poster's note. */
    messages?: ClaimMessage[];
    /** The claimer's profile, used to render their reply immediately after submitting. */
    currentUser?: { first_name: string; last_name: string | null; photo_url: string | null };
}

export function ClaimDetailSheet({
    post,
    currentUserId,
    onClose,
    onClaimChange,
    onCancelled,
    contact,
    messages,
    currentUser,
}: ClaimDetailSheetProps) {
    const [loading, setLoading] = useState(false);
    const [conflict, setConflict] = useState<{ date: string; time: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notifyState, setNotifyState] = useState<"idle" | "loading" | "done">(post.user_notify_me ? "done" : "idle");
    const [showReport, setShowReport] = useState(false);
    // Claim status is tracked locally so the sheet can transition in place
    // (claimable → pending) without closing after the user claims.
    const [claimStatus, setClaimStatus] = useState(post.user_claim_status);
    const [claimId, setClaimId] = useState(post.user_claim_id);
    const [cancelling, setCancelling] = useState(false);
    // Reply field (design 149-1155): send follow-up messages once the claim is active.
    const [reply, setReply] = useState("");
    const [sendingReply, setSendingReply] = useState(false);
    // Pick a random default reply once per sheet; sent as the claim's first message.
    const [defaultReply] = useState(() => DEFAULT_REPLIES[Math.floor(Math.random() * DEFAULT_REPLIES.length)]);
    const defaultMessage = `Hey ${post.first_name}, ${defaultReply}`;
    // Messages sent optimistically this session (initial default + replies), shown
    // immediately; the feed refetch reconciles them via `messages`.
    const [localSent, setLocalSent] = useState<ClaimMessage[]>([]);
    const { shareData, handleShare, closeShareModal } = useShare();

    // Build a local message row from the claimer's profile for optimistic display.
    const makeLocalMessage = useCallback(
        (body: string): ClaimMessage => ({
            id: `local-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
            sender_id: currentUserId ?? "me",
            body,
            created_at: new Date().toISOString(),
            first_name: currentUser?.first_name ?? "You",
            last_name: currentUser?.last_name ?? "",
            photo_url: currentUser?.photo_url ?? null,
        }),
        [currentUserId, currentUser],
    );

    // The claim thread — server messages plus any optimistic sends not yet reflected.
    const baseMessages = messages ?? [];
    const seenBodies = new Set(baseMessages.map((m) => `${m.sender_id}|${m.body}`));
    const threadMessages = [...baseMessages, ...localSent.filter((m) => !seenBodies.has(`${m.sender_id}|${m.body}`))];

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const isOwnPost = currentUserId === post.author_id;
    const activeClaim = claimStatus === "pending" || claimStatus === "approved";
    const isFull = post.spots_available <= 0;
    const isExpired = post.status === "expired";

    const handleClaim = useCallback(async () => {
        setLoading(true);
        setError(null);
        setConflict(null);

        // Claim with no message — pass p_message: null so PostgREST resolves the
        // overloaded submit_claim (the RPC skips inserting a message when it's null).
        const { data, error: rpcError } = await supabase.rpc("submit_claim", { p_post_id: post.id, p_message: null });
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
        // Transition the sheet to the pending state in place (keep it open).
        setClaimId(data.claim_id as string);
        setClaimStatus("pending");
        onClaimChange?.();
    }, [post.id, post.author_id, onClaimChange]);

    // Send a follow-up reply (arrow button or Enter) via send_claim_message.
    const handleSendReply = useCallback(async () => {
        const body = reply.trim();
        if (!body || !claimId || sendingReply) return;
        setSendingReply(true);
        setLocalSent((prev) => [...prev, makeLocalMessage(body)]);
        setReply("");
        await supabase.rpc("send_claim_message", { p_claim_id: claimId, p_body: body });
        setSendingReply(false);
        onClaimChange?.();
    }, [reply, claimId, sendingReply, makeLocalMessage, onClaimChange]);

    const handleNotifyMe = useCallback(async () => {
        if (notifyState !== "idle") return;
        setNotifyState("loading");
        await supabase.rpc("add_notify_me", { p_post_id: post.id });
        setNotifyState("done");
    }, [post.id, notifyState]);

    const handleCancel = useCallback(async () => {
        if (!claimId) return;
        setCancelling(true);
        setError(null);
        const { error: rpcError } = await supabase.rpc("unclaim", { p_claim_id: claimId });
        if (rpcError) {
            setCancelling(false);
            setError("Something went wrong. Please try again.");
            return;
        }
        // Cancel succeeded — refresh the feed, then show the "reopened" banner (which
        // also closes the sheet) or just close if no banner handler is provided.
        onClaimChange?.();
        if (onCancelled) onCancelled(post);
        else onClose();
    }, [claimId, onClaimChange, onCancelled, onClose, post]);

    const playType = formatPlayType(post.play_type);
    const title = [playType, "Tennis"].filter(Boolean).join(" ");
    const posterName = post.last_name ? `${post.first_name} ${post.last_name}.` : post.first_name;
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");
    const costLabel = post.cost != null ? `Claim for $${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Claim spot";

    // Claim-status banner shown to the claiming user (pending → approved).
    const claimApproved = claimStatus === "approved";
    const claimStatusMessage = claimApproved ? "Your claim has been approved!" : "Your claim is pending approval";
    const showContact = claimApproved && !!contact && (!!contact.venmoHandle || !!contact.phone);
    // Pay CTA needs the poster's Venmo handle; the amount is included only when the post has a cost.
    const venmoHref = contact?.venmoHandle
        ? `https://venmo.com/${encodeURIComponent(contact.venmoHandle)}?txn=pay${post.cost != null ? `&amount=${post.cost.toFixed(2)}` : ""}&note=${encodeURIComponent(`CourtPlay - ${court ?? "Tennis"}`)}`
        : null;
    const payLabel = post.cost != null ? `Pay $${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)} with Venmo` : "Pay with Venmo";

    // pr-8 keeps the title/subtitle clear of the absolutely-positioned close button.
    const titleHeader = (
        <div className="flex min-w-0 flex-col gap-1 pr-8">
            <h2 id="claim-sheet-title" className="text-md font-semibold text-primary">
                {title}
                {when && ` · ${when}`}
            </h2>
            {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
        </div>
    );

    const shareButton = (
        <button type="button" onClick={() => handleShare(post)} className={SECONDARY_BTN}>
            Share with a friend
        </button>
    );

    const claimableHelper = !isOwnPost && !activeClaim && !isFull && !isExpired;
    // Detail + pending share the same title/poster/note; pin their action area to the
    // bottom (min-height) so those elements don't shift when the states swap.
    const needsPin = claimableHelper || (activeClaim && !claimApproved);

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
                {/* Close button — absolute so it doesn't affect the content spacing. */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-3 z-10 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" />
                </button>

                {/* Header — claim-status text once claimed, otherwise just the title. */}
                {activeClaim && <p className="pr-8 text-sm text-brand-500">{claimStatusMessage}</p>}
                {titleHeader}

                {/* Poster + price — design adds a 4px lead-in (20px above). */}
                <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                            size="xs"
                            src={post.photo_url}
                            alt={post.first_name}
                            initials={post.first_name.charAt(0).toUpperCase()}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <span className="truncate text-xs text-tertiary">
                            {posterName} · {timeAgo(post.created_at)}
                        </span>
                    </div>
                    {post.post_type === "sub_need" && (
                        <span className="shrink-0 text-sm font-semibold text-primary">
                            {post.cost != null ? `$${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Free"}
                        </span>
                    )}
                </div>

                {/* Notes */}
                {post.notes && (
                    <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}

                {/* Claimer's reply(ies), indented under the note once the claim is active (design 274-4741). */}
                {activeClaim &&
                    threadMessages.map((m) => <ThreadMessage key={m.id} msg={m} />)}

                {/* Poster contact — revealed once approved */}
                {showContact && (
                    <div className="flex flex-col gap-0.5 text-sm text-tertiary">
                        {contact!.phone && <p>Phone: {contact!.phone}</p>}
                        {contact!.venmoHandle && <p>Venmo: @{contact!.venmoHandle}</p>}
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

                {/* Action area — pinned to the bottom (min-height + mt-auto buttons) so the
                    title, subtitle, and poster keep the same screen position when the sheet
                    transitions from claimable → pending. 32px lead-in above (mt-4). */}
                <div className={`mt-4 flex flex-col gap-4${needsPin ? " min-h-40" : ""}`}>
                {/* Reply field (design 149-1155): Enter or the arrow sends. */}
                {activeClaim && !claimApproved && (
                    <div className="flex h-9 w-full items-center gap-2 rounded-lg bg-tertiary px-3 shadow-xs ring-1 ring-neutral-600 ring-inset">
                        <input
                            aria-label="Reply"
                            value={reply}
                            onChange={(e) => setReply(e.target.value.slice(0, MESSAGE_MAX))}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendReply();
                                }
                            }}
                            disabled={sendingReply}
                            placeholder={defaultMessage}
                            className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-placeholder disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={handleSendReply}
                            disabled={!reply.trim() || sendingReply}
                            aria-label="Send reply"
                            className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-secondary disabled:opacity-40"
                        >
                            <ArrowCircleRight className="size-6" aria-hidden="true" />
                        </button>
                    </div>
                )}

                {/* Detail-state helper (design 49-206). */}
                {claimableHelper && (
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

                {/* Pending-claim helper (design 149-1155). */}
                {activeClaim && !claimApproved && currentUserId && (
                    <p className="text-xs text-tertiary">
                        * Have an issue?{" "}
                        <button
                            type="button"
                            onClick={() => setShowReport(true)}
                            className="text-tertiary underline underline-offset-2 transition duration-100 ease-linear hover:text-secondary"
                        >
                            Report claim
                        </button>
                    </p>
                )}

                {/* Primary action — pinned to the bottom of the action area. */}
                <div className="mt-auto flex flex-col gap-3">
                    {isOwnPost ? (
                        <>
                            <p className="text-center text-sm text-tertiary">This is your post.</p>
                            {shareButton}
                        </>
                    ) : activeClaim ? (
                        <>
                            {claimApproved && venmoHref && (
                                <a href={venmoHref} target="_blank" rel="noopener noreferrer" className={PRIMARY_BTN}>
                                    {payLabel}
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={cancelling}
                                className={`${SECONDARY_BTN} flex items-center justify-center`}
                            >
                                {cancelling ? (
                                    <span
                                        className="size-5 animate-spin rounded-full border-2 border-secondary border-t-transparent"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    "Cancel claim"
                                )}
                            </button>
                        </>
                    ) : isExpired ? (
                        <>
                            <p className="text-center text-sm text-tertiary">This post has expired.</p>
                            {shareButton}
                        </>
                    ) : isFull ? (
                        <>
                            {notifyState === "done" ? (
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
                            )}
                            {shareButton}
                        </>
                    ) : (
                        // Detail state (design 49-206): claim immediately, then transition
                        // to the pending view (design 149-1155) in place.
                        <>
                            <button
                                type="button"
                                onClick={handleClaim}
                                disabled={loading || !!conflict}
                                className={PRIMARY_BTN}
                            >
                                {loading ? <ButtonSpinner /> : costLabel}
                            </button>
                            {shareButton}
                        </>
                    )}
                </div>
                </div>

            </motion.div>

            {shareData && <ShareModal url={shareData.url} text={shareData.text} onClose={closeShareModal} />}
            {showReport && <ReportModal targetType="post" targetId={post.id} onClose={() => setShowReport(false)} />}
        </div>
    );
}
