import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { SubCard } from "@/components/app/sub-card";
import { ThreadMessage } from "@/components/app/thread-message";
import { supabase } from "@/lib/supabase";
import type { ClaimMessage } from "@/types/activity";
import type { FeedPost } from "@/types/feed";
import { reasonLabel, reportTargetLabel, reportUserName, type AdminReportRow } from "./admin-report-card";

const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

// Inherits each button's text color so it reads on both the destructive and secondary buttons.
const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
);

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = { pending: "Pending", dismissed: "Dismissed", actioned: "Actioned" };

interface ReportConversation {
    claim_id: string;
    claimer_name: string | null;
    claim_status: string;
    // Same shape as the feed thread so we can reuse ThreadMessage.
    messages: ClaimMessage[];
}
interface PostReportContext {
    post: FeedPost;
    conversations: ReportConversation[];
}

interface AdminReportDetailSheetProps {
    report: AdminReportRow;
    /** True while one of this report's actions is in flight (disables all buttons). */
    actioning: boolean;
    onDismiss: () => void;
    onRemoveContent: () => void;
    /** Restore a removed post (shown for reports in the Removed tab). */
    onReactivate: () => void;
    onClose: () => void;
}

/** Admin moderation sheet for a single report — dismiss, remove, or reactivate the content. */
export function AdminReportDetailSheet({ report, actioning, onDismiss, onRemoveContent, onReactivate, onClose }: AdminReportDetailSheetProps) {
    const isPost = report.target_type === "post";
    const [context, setContext] = useState<PostReportContext | null>(null);
    const [ctxLoading, setCtxLoading] = useState(isPost);
    const [ctxError, setCtxError] = useState<string | null>(null);
    // "confirm" swaps the sheet body for a remove/suspend confirmation (like the users sheet).
    const [mode, setMode] = useState<"view" | "confirm">("view");

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    // Post reports show the reported post + its claim conversations (admin-only RPC).
    useEffect(() => {
        if (!isPost) return;
        let cancelled = false;
        setCtxLoading(true);
        setCtxError(null);
        supabase.rpc("admin_get_post_report", { p_post_id: report.target_id }).then(({ data, error }) => {
            if (cancelled) return;
            if (error) setCtxError(error.message);
            else setContext(data as PostReportContext);
            setCtxLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [isPost, report.target_id]);

    const removeLabel = isPost ? "Remove post" : "Suspend user";

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-report-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h2 id="admin-report-sheet-title" className="truncate text-md font-semibold text-primary">
                            {reportTargetLabel(report)}
                        </h2>
                        <p className="truncate text-xs text-tertiary">
                            Reported for {reasonLabel(report.reason)} · {formatDate(report.created_at)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" strokeWidth={1} />
                    </button>
                </div>

                {mode === "confirm" ? (
                    /* Remove/suspend confirmation */
                    <div className="mt-1 flex shrink-0 flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-md font-semibold text-primary">
                                {isPost ? "Remove this post?" : "Suspend this user?"}
                            </h3>
                            <p className="text-sm text-secondary">
                                {isPost
                                    ? "It will be removed from the feed. You can reactivate it later from the Removed tab."
                                    : "They won't be able to post or claim spots until reinstated."}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button type="button" onClick={onRemoveContent} disabled={actioning} className={PRIMARY_BTN}>
                                {actioning ? <ButtonSpinner /> : isPost ? "Yes, remove" : "Yes, suspend"}
                            </button>
                            <button type="button" onClick={() => setMode("view")} disabled={actioning} className={SECONDARY_BTN}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Scrollable body */}
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                            {/* Reporter's note */}
                            {report.note && (
                                <div className="rounded-lg border border-tertiary px-3 py-2.5">
                                    <p className="text-sm text-secondary">{report.note}</p>
                                </div>
                            )}

                            {isPost ? (
                                ctxLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="size-6 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                                    </div>
                                ) : ctxError || !context?.post ? (
                                    <p className="py-6 text-center text-sm text-tertiary">This post is no longer available.</p>
                                ) : (
                                    <>
                                        <SubCard post={context.post} />
                                        <ReportConversations conversations={context.conversations} />
                                    </>
                                )
                            ) : (
                                <dl className="flex flex-col gap-2 rounded-lg border border-neutral-700 p-4 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-tertiary">User</dt>
                                        <dd className="truncate text-secondary">{reportUserName(report.userTarget)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-tertiary">Email</dt>
                                        <dd className="truncate text-secondary">{report.userTarget?.email ?? "—"}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-tertiary">Status</dt>
                                        <dd className="text-secondary">{STATUS_LABELS[report.status] ?? report.status}</dd>
                                    </div>
                                    {report.reviewed_at && (
                                        <div className="flex justify-between gap-3">
                                            <dt className="text-tertiary">Reviewed</dt>
                                            <dd className="text-secondary">{formatDate(report.reviewed_at)}</dd>
                                        </div>
                                    )}
                                </dl>
                            )}
                        </div>

                        {/* Actions */}
                        {report.status === "pending" ? (
                            <div className="mt-1 flex shrink-0 flex-col gap-3">
                                <button type="button" onClick={() => setMode("confirm")} disabled={actioning} className={PRIMARY_BTN}>
                                    {actioning ? <ButtonSpinner /> : removeLabel}
                                </button>
                                <button type="button" onClick={onDismiss} disabled={actioning} className={SECONDARY_BTN}>
                                    {actioning ? <ButtonSpinner /> : "Dismiss"}
                                </button>
                            </div>
                        ) : report.status === "actioned" && isPost ? (
                            <div className="mt-1 flex shrink-0 flex-col gap-3">
                                <button type="button" onClick={onReactivate} disabled={actioning} className={PRIMARY_BTN}>
                                    {actioning ? <ButtonSpinner /> : "Reactivate post"}
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </motion.div>
        </div>
    );
}

/** The claim message threads on a reported post, rendered with the feed's ThreadMessage. */
function ReportConversations({ conversations }: { conversations: ReportConversation[] }) {
    if (conversations.length === 0) {
        return <p className="text-xs text-tertiary">No comments on this post.</p>;
    }
    return (
        <div className="flex flex-col gap-4">
            <p className="text-xs font-medium text-tertiary">Comments</p>
            {conversations.map((convo) => (
                <div key={convo.claim_id} className="flex flex-col gap-4">
                    <p className="text-xs text-tertiary">Conversation with {convo.claimer_name ?? "Unknown"}</p>
                    {convo.messages.map((m) => (
                        <ThreadMessage key={m.id} msg={m} />
                    ))}
                </div>
            ))}
        </div>
    );
}
