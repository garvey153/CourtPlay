import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowCircleRight, ArrowLeft, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import type { ClaimRow, MyPost } from "@/types/activity";
import { ThreadMessage } from "./thread-message";
import { ReportModal } from "./report-modal";

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

interface RegularConnectionsSheetProps {
    post: MyPost;
    /** The current user (post author). */
    poster: Poster;
    onClose: () => void;
    /** Open the post in the edit form (no-connections state). */
    onEdit: () => void;
    /** Remove the post (the seeker found a spot). Responders are notified by the caller. */
    onDelete: () => void;
    /** Send a reply in a specific connection's thread. */
    onReply: (claimId: string, body: string) => void | Promise<void>;
    /** Whether the post is currently being removed. */
    deleting?: boolean;
}

function connectionName(c: ClaimRow): string {
    return c.last_name ? `${c.first_name} ${c.last_name.charAt(0).toUpperCase()}.` : c.first_name;
}

/**
 * The seeker's view of their own regular-play post (they're looking to join a group).
 * Responders reach out; this sheet lists those conversations and opens each thread.
 * No approval — the seeker chats, then removes the post once they've found a spot.
 * Mirrors the sub "created" sheet design.
 */
export function RegularConnectionsSheet({ post, poster, onClose, onEdit, onDelete, onReply, deleting }: RegularConnectionsSheetProps) {
    const connections = post.claims;
    // null = list (or manage, when there are no connections). A single connection
    // opens straight into its thread; 2+ show the list first.
    const [selectedId, setSelectedId] = useState<string | null>(connections.length === 1 ? connections[0].id : null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(() => connections.find((c) => c.id === selectedId) ?? null, [connections, selectedId]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    // Keep the newest message in view as a thread grows.
    const messageCount = selected?.messages.length ?? 0;
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messageCount, selectedId]);

    const title = ["Tennis, Regular Play", post.skill_level ? `NTRP ${post.skill_level}` : null].filter(Boolean).join(" · ");
    const schedule = [post.preferred_days?.join(", "), post.preferred_times?.join(" / ")].filter(Boolean).join(" · ");
    const subtitle = [post.location ?? post.custom_court, schedule].filter(Boolean).join(" · ");
    const posterName = poster.last_name ? `${poster.first_name} ${poster.last_name.charAt(0).toUpperCase()}.` : poster.first_name;
    const canGoBack = connections.length > 1;

    const handleSend = async () => {
        const body = reply.trim();
        if (!body || !selected || sending) return;
        setSending(true);
        await onReply(selected.id, body);
        setReply("");
        setSending(false);
    };

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
            <h2 id="regular-sheet-title" className="text-md font-semibold text-primary">
                {title}
            </h2>
            {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
        </div>
    );

    const noteBubble = post.notes ? (
        <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
            <p className="text-sm text-secondary">“{post.notes}”</p>
        </div>
    ) : null;

    let content: React.ReactNode;

    if (confirmingDelete) {
        content = (
            <div className="flex flex-col gap-4 px-5 pt-5 pb-8">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-md font-semibold text-primary">Remove this post?</h2>
                        <p className="text-sm text-secondary">
                            {connections.length > 0
                                ? "Do this once you've found a spot. Your conversations stay in Activity."
                                : "This will permanently remove it from the app."}
                        </p>
                    </div>
                    {closeBtn}
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-neutral-600 p-4">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-md font-semibold text-primary">{title}</p>
                        {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2">
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
                </div>
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={onDelete} disabled={deleting} className={PRIMARY_BTN}>
                        {deleting ? <ButtonSpinner /> : "Yes, remove"}
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className={SECONDARY_BTN}>
                        No, keep it
                    </button>
                </div>
            </div>
        );
    } else if (selected) {
        // Thread view for one connection.
        content = (
            <>
                <div className="flex shrink-0 flex-col gap-4 px-5 pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            {canGoBack && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(null)}
                                    aria-label="Back to conversations"
                                    className="-ml-1 shrink-0 rounded-lg p-1 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                                >
                                    <ArrowLeft className="size-5" />
                                </button>
                            )}
                            <div className="flex min-w-0 items-center gap-2">
                                <Avatar
                                    size="xs"
                                    src={selected.photo_url}
                                    alt={selected.first_name}
                                    initials={selected.first_name.charAt(0).toUpperCase()}
                                    className="shrink-0 bg-white p-px shadow-xs"
                                />
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-semibold text-primary">{connectionName(selected)}</span>
                                    {selected.skill_level && <span className="text-xs text-tertiary">NTRP {selected.skill_level}</span>}
                                </div>
                            </div>
                        </div>
                        {closeBtn}
                    </div>
                </div>

                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div className="flex flex-col gap-5">
                        {noteBubble}
                        {selected.messages.length === 0 ? (
                            <p className="pl-8 text-sm text-tertiary">
                                {selected.first_name} connected — say hello to get started.
                            </p>
                        ) : (
                            selected.messages.map((m) => <ThreadMessage key={m.id} msg={m} />)
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col px-5 pt-4 pb-8">
                    <div className="flex h-9 w-full items-center gap-2 rounded-lg bg-tertiary px-3 shadow-xs ring-1 ring-neutral-600 ring-inset">
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
                            placeholder={`${selected.messages.length === 0 ? "Message" : "Reply"} ${selected.first_name}…`}
                            className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-placeholder disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={!reply.trim() || sending}
                            aria-label="Send reply"
                            className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-secondary disabled:opacity-40"
                        >
                            <ArrowCircleRight className="size-6" aria-hidden="true" />
                        </button>
                    </div>
                    <p className="mt-4 text-xs text-tertiary">
                        * Have an issue?{" "}
                        <button
                            type="button"
                            onClick={() => setShowReport(true)}
                            className="text-tertiary underline underline-offset-2 transition duration-100 ease-linear hover:text-secondary"
                        >
                            Report user
                        </button>
                    </p>
                    <div className="mt-8">
                        <button type="button" onClick={() => setConfirmingDelete(true)} className={`${SECONDARY_BTN} w-full`}>
                            Remove post
                        </button>
                    </div>
                </div>
            </>
        );
    } else if (connections.length > 0) {
        // Conversation list (2+ connections).
        content = (
            <div className="flex max-h-[calc(100dvh-61px)] flex-col">
                <div className="flex shrink-0 flex-col gap-4 px-5 pt-5">
                    <div className="flex items-start justify-between gap-3">
                        {titleBlock}
                        {closeBtn}
                    </div>
                    <p className="text-sm text-brand-500">
                        {connections.length} {connections.length === 1 ? "person" : "people"} reached out
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <ul className="flex flex-col gap-2">
                        {connections.map((c) => {
                            const last = c.messages[c.messages.length - 1];
                            const preview = last ? last.body : "New connection — say hello";
                            const when = last ? last.created_at : c.created_at;
                            return (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(c.id)}
                                        className="flex w-full items-center gap-3 rounded-lg border border-neutral-600 px-3 py-2.5 text-left transition duration-100 ease-linear hover:bg-secondary_hover"
                                    >
                                        <Avatar
                                            size="sm"
                                            src={c.photo_url}
                                            alt={c.first_name}
                                            initials={c.first_name.charAt(0).toUpperCase()}
                                            className="shrink-0 bg-white p-px shadow-xs"
                                        />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className="truncate text-sm font-semibold text-primary">{connectionName(c)}</span>
                                                <span className="shrink-0 text-xs text-tertiary">{timeAgo(when)}</span>
                                            </div>
                                            <span className="truncate text-xs text-tertiary">{preview}</span>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="flex shrink-0 flex-col px-5 pt-4 pb-8">
                    <button type="button" onClick={() => setConfirmingDelete(true)} className={`${SECONDARY_BTN} w-full`}>
                        Remove post
                    </button>
                </div>
            </div>
        );
    } else {
        // No connections yet — manage the post.
        content = (
            <div className="flex flex-col gap-4 px-5 pt-5 pb-8">
                <div className="flex items-start justify-between gap-3">
                    {titleBlock}
                    {closeBtn}
                </div>
                <div className="flex items-center gap-2">
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
                {noteBubble}
                <p className="text-sm text-tertiary">No one has reached out yet. You'll see their messages here.</p>
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={onEdit} className={PRIMARY_BTN}>
                        Edit post
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(true)} className={SECONDARY_BTN}>
                        Remove post
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regular-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex max-h-[calc(100dvh-61px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-secondary shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {content}
            </motion.div>

            {showReport && selected && (
                <ReportModal targetType="user" targetId={selected.claimer_id} onClose={() => setShowReport(false)} />
            )}
        </div>
    );
}
