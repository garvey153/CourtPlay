import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowCircleRight, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { useShare } from "@/hooks/use-share";
import { cx } from "@/utils/cx";
import type { FeedPost } from "@/types/feed";
import type { ClaimMessage } from "@/types/activity";
import { ShareModal } from "./share-modal";
import { ReportModal } from "./report-modal";
import { ThreadMessage } from "./thread-message";

const MESSAGE_MAX = 150;

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// Bottom-sheet button styles, shared with the claim/filters sheets so all match.
const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

/** Spinner tuned for the brand button (dark strokes on green). */
const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

interface GroupDetailSheetProps {
    post: FeedPost;
    currentUserId?: string | null;
    onClose: () => void;
    /** Refresh the caller's feed/lists after connecting or sending a message. */
    onChange?: () => void;
    /** Called after the connection is cancelled (caller closes/refreshes). */
    onCancelled?: () => void;
    /** Existing conversation on this connection (shown once connected). */
    messages?: ClaimMessage[];
    /** The current user's profile, used to render their own messages immediately. */
    currentUser?: { first_name: string; last_name: string | null; photo_url: string | null };
}

/**
 * Detail bottom sheet for a regular-play (blue) post. A regular post is from one
 * person looking to join a group; tapping "Connect" starts a direct conversation
 * with them (no approval). Once connected the sheet becomes a message thread. Same
 * styling as the sub claim sheet.
 */
export function GroupDetailSheet({ post, currentUserId, onClose, onChange, onCancelled, messages, currentUser }: GroupDetailSheetProps) {
    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showReport, setShowReport] = useState(false);
    // Connection state is tracked locally so the sheet can transition in place
    // (connectable → connected) without closing after the user connects.
    const [claimStatus, setClaimStatus] = useState(post.user_claim_status);
    const [claimId, setClaimId] = useState(post.user_claim_id);
    // Opening/reply message field.
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    // Messages sent optimistically this session, shown immediately; the refetch reconciles them.
    const [localSent, setLocalSent] = useState<ClaimMessage[]>([]);
    const { shareData, handleShare, closeShareModal } = useShare();

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
    const isConnected = claimStatus === "pending" || claimStatus === "approved";
    // The seeker filled their spot (post removed) or it aged out — the thread goes read-only.
    const postClosed = post.status !== "active";

    // Connect: create the connection, then transition the sheet to the connected/
    // thread state in place (the message field appears once connected).
    const handleConnect = useCallback(async () => {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc("submit_claim", {
            p_post_id: post.id,
            p_message: null,
        });
        setLoading(false);

        if (rpcError) {
            setError("Something went wrong. Please try again.");
            return;
        }
        if (!data.success) {
            setError(data.error ?? "Could not connect to this group.");
            return;
        }

        sendNotification({
            user_id: post.author_id,
            notification_type: "connection_request",
            post_id: post.id,
            claim_id: data.claim_id as string,
        });
        setClaimId(data.claim_id as string);
        setClaimStatus("pending");
        onChange?.();
    }, [post.id, post.author_id, onChange]);

    // Send a follow-up message once connected.
    const handleSend = useCallback(async () => {
        const body = message.trim();
        if (!body || !claimId || sending) return;
        setSending(true);
        setLocalSent((prev) => [...prev, makeLocalMessage(body)]);
        setMessage("");
        await supabase.rpc("send_claim_message", { p_claim_id: claimId, p_body: body });
        setSending(false);
        onChange?.();
    }, [message, claimId, sending, makeLocalMessage, onChange]);

    // Back out of the connection (removes it from the seeker's list).
    const handleCancel = useCallback(async () => {
        if (!claimId || cancelling) return;
        setCancelling(true);
        setError(null);
        const { error: rpcError } = await supabase.rpc("unclaim", { p_claim_id: claimId });
        if (rpcError) {
            setCancelling(false);
            setError("Something went wrong. Please try again.");
            return;
        }
        onChange?.();
        if (onCancelled) onCancelled();
        else onClose();
    }, [claimId, cancelling, onChange, onCancelled, onClose]);

    const posterName = post.last_name ? `${post.first_name} ${post.last_name.charAt(0).toUpperCase()}.` : post.first_name;
    const title = ["Tennis, Regular Play", post.skill_level ? `NTRP ${post.skill_level}` : null].filter(Boolean).join(" · ");
    const location = post.location ?? post.custom_court;

    // The message field only appears once connected (there's no compose step before
    // connecting). A closed post's thread is read-only.
    const showMessageField = !isOwnPost && isConnected && !postClosed;
    const statusLine = isConnected
        ? postClosed
            ? `${post.first_name} found a spot. This post is now closed.`
            : `You're connected! Message ${post.first_name} to sort out the details.`
        : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {/* Close button — absolute so it doesn't affect content spacing. */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-3 z-10 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" />
                </button>

                {/* Header — status line once connected, otherwise just the title. */}
                {statusLine && <p className="pr-8 text-sm text-brand-500">{statusLine}</p>}
                <div className="flex min-w-0 flex-col gap-1 pr-8">
                    <h2 id="group-sheet-title" className="text-md font-semibold text-primary">
                        {title}
                    </h2>
                    {location && <p className="text-sm text-secondary">{location}</p>}
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
                    <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}

                {/* Conversation thread, once connected. */}
                {isConnected && threadMessages.map((m) => <ThreadMessage key={m.id} msg={m} />)}

                {error && <p className="text-sm text-error-primary">{error}</p>}

                {/* Reply field — only once connected. mt-4 on top of the parent's 16px
                    gap puts 32px between the last message bubble and the input. */}
                {showMessageField && (
                    <div className="mt-4 flex h-9 w-full items-center gap-2 rounded-lg bg-tertiary px-3 shadow-xs ring-1 ring-neutral-600 ring-inset">
                        <input
                            aria-label="Message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={sending}
                            placeholder={`Reply to ${post.first_name}…`}
                            className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-placeholder disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={!message.trim() || sending}
                            aria-label="Send message"
                            className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-secondary disabled:opacity-40"
                        >
                            <ArrowCircleRight className="size-6" aria-hidden="true" />
                        </button>
                    </div>
                )}

                {/* Helper text — before connecting. */}
                {!isOwnPost && !isConnected && !postClosed && (
                    <p className="text-xs text-tertiary">
                        * Connecting starts a conversation with {post.first_name}.
                        {currentUserId && (
                            <>
                                {" "}
                                Have a problem?{" "}
                                <button
                                    type="button"
                                    onClick={() => setShowReport(true)}
                                    className="text-tertiary underline underline-offset-2 transition duration-100 ease-linear hover:text-secondary"
                                >
                                    Report issue
                                </button>
                            </>
                        )}
                    </p>
                )}

                {/* Primary action. Connected + active puts 32px above the Cancel button
                    (mt-4 on top of the parent's 16px gap = 32px from the message field). */}
                <div className={cx("flex flex-col gap-3", isConnected && !postClosed && "mt-4")}>
                    {isOwnPost ? (
                        <p className="text-center text-sm text-tertiary">This is your post.</p>
                    ) : isConnected ? (
                        // Connected: the thread + message field above are the interaction.
                        // An active post can be cancelled; a closed one is read-only.
                        !postClosed ? (
                            <button type="button" onClick={handleCancel} disabled={cancelling} className={SECONDARY_BTN}>
                                {cancelling ? (
                                    <span
                                        className="size-5 animate-spin rounded-full border-2 border-secondary border-t-transparent"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    "Cancel connection"
                                )}
                            </button>
                        ) : null
                    ) : postClosed ? (
                        <>
                            <p className="text-center text-sm text-tertiary">This post is no longer active.</p>
                            <button type="button" onClick={() => handleShare(post)} className={SECONDARY_BTN}>
                                Share with a friend
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={handleConnect} disabled={loading} className={PRIMARY_BTN}>
                                {loading ? <ButtonSpinner /> : "Connect"}
                            </button>
                            <button type="button" onClick={() => handleShare(post)} className={SECONDARY_BTN}>
                                Share with a friend
                            </button>
                        </>
                    )}
                </div>
            </motion.div>

            {shareData && <ShareModal url={shareData.url} text={shareData.text} onClose={closeShareModal} />}
            {showReport && <ReportModal targetType="post" targetId={post.id} onClose={() => setShowReport(false)} />}
        </div>
    );
}
