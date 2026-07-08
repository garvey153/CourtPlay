import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import type { ClaimRow, MyPost } from "@/types/activity";
import { ThreadMessage } from "./thread-message";
import { ReportModal } from "./report-modal";

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
    /** Send a reply in the claim thread; resolves once the thread is refreshed. */
    onReply?: (body: string) => void | Promise<void>;
}

const MESSAGE_MAX = 150;

/**
 * Creator's view of one of their posts (Created tab). When the post has a pending
 * claim it shows "Your post has been claimed!" with the claimant and Approve /
 * Decline. Matches design 274-4741.
 */
export function CreatedDetailSheet({ post, poster, onClose, onApprove, onDecline, onEdit, onDelete, actionLoading, deleting, onReply }: CreatedDetailSheetProps) {
    // Delete confirmation is shown inline in this same sheet (no close/reopen).
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
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

    const messages = claim?.messages ?? [];
    const claimerFirstName = claim?.first_name ?? "";

    const handleSend = async () => {
        const body = reply.trim();
        if (!body || !onReply || sending) return;
        setSending(true);
        await onReply(body);
        setReply("");
        setSending(false);
    };

    // Approving sends any typed reply first (so it lands in the thread), then approves.
    const handleApproveClick = async () => {
        if (!pendingClaim || busy) return;
        const body = reply.trim();
        if (body && onReply) {
            setSending(true);
            await onReply(body);
            setReply("");
            setSending(false);
        }
        onApprove(pendingClaim);
    };

    // Keep the newest message in view as the thread grows.
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const closeBtn = (
        <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
        >
            <XClose className="size-5" />
        </button>
    );
    const titleBlock = (
        <div className="flex min-w-0 flex-col gap-1">
            <h2 id="created-sheet-title" className="text-md font-semibold text-primary">
                {title}
                {when && ` · ${when}`}
            </h2>
            {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
        </div>
    );
    const posterPrice = (
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
    );
    const noteBubble = post.notes ? (
        <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
            <p className="text-sm text-secondary">“{post.notes}”</p>
        </div>
    ) : null;
    const contactBlock =
        approvedClaim && (approvedClaim.phone || approvedClaim.venmo_handle) ? (
            <div className="flex flex-col gap-0.5 pl-8 text-sm text-tertiary">
                {approvedClaim.phone && <p>Phone: {approvedClaim.phone}</p>}
                {approvedClaim.venmo_handle && <p>Venmo: @{approvedClaim.venmo_handle}</p>}
            </div>
        ) : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="created-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex max-h-[calc(100dvh-61px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-secondary shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {confirmingDelete ? (
                    <div className="flex flex-col gap-4 px-5 pt-5 pb-8">
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
                            <button type="button" onClick={onClose} disabled={deleting} className={SECONDARY_BTN}>
                                No, keep it
                            </button>
                        </div>
                    </div>
                ) : claim ? (
                    <>
                        {/* Claimed — message thread (design 274-4741). Header + footer pinned; thread scrolls. */}
                        <div className="flex shrink-0 flex-col gap-4 px-5 pt-5">
                            <div className="flex items-start justify-between gap-3">
                                {banner ? <p className="text-sm text-brand-500">{banner}</p> : titleBlock}
                                {closeBtn}
                            </div>
                            {banner && titleBlock}
                            {posterPrice}
                        </div>

                        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                            <div className="flex flex-col gap-5">
                                {noteBubble}
                                {messages.map((m) => (
                                    <ThreadMessage key={m.id} msg={m} />
                                ))}
                                {contactBlock}
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-col px-5 pt-4 pb-8">
                            {onReply && (
                                <input
                                    aria-label="Reply"
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value.slice(0, MESSAGE_MAX))}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    disabled={sending}
                                    placeholder={`Reply to ${claimerFirstName}…`}
                                    className="w-full rounded-lg bg-tertiary px-3 py-2.5 text-sm text-primary shadow-xs ring-1 ring-neutral-600 outline-none ring-inset placeholder:text-placeholder disabled:opacity-50"
                                />
                            )}
                            {claim && (
                                <p className="mt-4 text-xs text-tertiary">
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
                            {pendingClaim ? (
                                <div className="mt-8 flex flex-col gap-3">
                                    <button type="button" onClick={handleApproveClick} disabled={busy || sending} className={PRIMARY_BTN}>
                                        {busy || sending ? <ButtonSpinner /> : "Approve claim"}
                                    </button>
                                    <button type="button" onClick={() => onDecline(pendingClaim)} disabled={busy} className={SECONDARY_BTN}>
                                        Decline
                                    </button>
                                </div>
                            ) : approvedClaim ? (
                                <div className="mt-8 flex flex-col gap-3">
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
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-4 px-5 pt-5 pb-8">
                        {/* No claims yet — manage the post (design 271-4581). */}
                        <div className="flex items-start justify-between gap-3">
                            {titleBlock}
                            {closeBtn}
                        </div>
                        {posterPrice}
                        {noteBubble}
                        <div className="mt-4 flex flex-col gap-3">
                            <button type="button" onClick={onEdit} className={PRIMARY_BTN}>
                                Edit post
                            </button>
                            <button type="button" onClick={() => setConfirmingDelete(true)} className={SECONDARY_BTN}>
                                Delete post
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {showReport && claim && (
                <ReportModal targetType="user" targetId={claim.claimer_id} onClose={() => setShowReport(false)} />
            )}
        </div>
    );
}
