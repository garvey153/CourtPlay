import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import { formatWhen, formatPlayType, formatDuration, timeAgo } from "@/components/app/sub-card";
import { claimKind, claimerName, type AdminClaimRow } from "./admin-claim-card";

const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatResponseTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

const STATUS_COLOR: Record<string, string> = {
    approved: "text-success-primary",
    rejected: "text-error-primary",
    pending: "text-secondary",
    cancelled: "text-tertiary",
    unclaimed: "text-tertiary",
};

type Mode = "view" | "confirmCancel";

interface AdminClaimDetailSheetProps {
    claim: AdminClaimRow;
    onClose: () => void;
    /** Refetch the list after cancelling. */
    onSaved: () => void;
}

/** Admin moderation sheet for a single claim — details + Cancel claim. */
export function AdminClaimDetailSheet({ claim, onClose, onSaved }: AdminClaimDetailSheetProps) {
    const [mode, setMode] = useState<Mode>("view");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const { label } = claimKind(claim.status);
    const title = [formatPlayType(claim.play_type), "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(claim.game_date, claim.game_time);
    const court = claim.location ?? claim.custom_court;
    const subtitle = [court, claim.skill_level ? `NTRP ${claim.skill_level}` : null, formatDuration(claim.duration)]
        .filter(Boolean)
        .join(" · ");
    const priceLabel = claim.cost != null ? `$${claim.cost % 1 === 0 ? claim.cost : claim.cost.toFixed(2)}` : "Free";
    const fullName = [claim.claimer_first_name, claim.claimer_last_name].filter(Boolean).join(" ") || claimerName(claim);
    const isCancelled = claim.status === "cancelled";

    const cancelClaim = async () => {
        setLoading(true);
        setError(null);
        const { error: updateError } = await supabase.from("claims").update({ status: "cancelled" }).eq("id", claim.id);
        if (updateError) {
            setError(`Failed to cancel: ${updateError.message}`);
            setLoading(false);
            return;
        }
        // Notify both the claimer and the poster.
        await sendNotification({ user_id: claim.claimer_id, notification_type: "claimer_cancelled", post_id: claim.post_id, claim_id: claim.id });
        if (claim.post_author_id) {
            await sendNotification({ user_id: claim.post_author_id, notification_type: "claimer_cancelled", post_id: claim.post_id, claim_id: claim.id });
        }
        setLoading(false);
        onSaved();
    };

    const closeBtn = (
        <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
        >
            <XClose className="size-5" strokeWidth={1} />
        </button>
    );

    const errorLine = error ? <p className="text-sm text-error-primary">{error}</p> : null;

    let body: React.ReactNode;
    if (mode === "confirmCancel") {
        body = (
            <>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-md font-semibold text-primary">Cancel this claim?</h2>
                        <p className="text-sm text-secondary">The claimer and poster will both be notified.</p>
                    </div>
                    {closeBtn}
                </div>
                {errorLine}
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={cancelClaim} disabled={loading} className={PRIMARY_BTN}>
                        {loading ? <ButtonSpinner /> : "Yes, cancel claim"}
                    </button>
                    <button type="button" onClick={() => setMode("view")} disabled={loading} className={SECONDARY_BTN}>
                        Keep claim
                    </button>
                </div>
            </>
        );
    } else {
        body = (
            <>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 id="admin-claim-sheet-title" className="text-md font-semibold text-primary">
                            {title}
                            {when && ` · ${when}`}
                        </h2>
                        {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
                    </div>
                    {closeBtn}
                </div>

                {/* Claimer row */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                            size="xs"
                            src={claim.claimer_photo_url}
                            alt={fullName}
                            initials={(claim.claimer_first_name ?? claim.claimer_email ?? "?").charAt(0).toUpperCase()}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <span className="truncate text-xs text-tertiary">
                            {fullName} · {timeAgo(claim.created_at)}
                        </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">{priceLabel}</span>
                </div>

                {/* Metadata */}
                <dl className="flex flex-col gap-2 rounded-lg border border-neutral-700 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                        <dt className="text-tertiary">Status</dt>
                        <dd className={STATUS_COLOR[claim.status] ?? "text-secondary"}>{label}</dd>
                    </div>
                    {claim.claimer_email && (
                        <div className="flex justify-between gap-3">
                            <dt className="text-tertiary">Claimer</dt>
                            <dd className="truncate text-secondary">{claim.claimer_email}</dd>
                        </div>
                    )}
                    <div className="flex justify-between gap-3">
                        <dt className="text-tertiary">Claimed</dt>
                        <dd className="text-secondary">{formatDate(claim.created_at)}</dd>
                    </div>
                    {claim.poster_avg_response_seconds != null && (
                        <div className="flex justify-between gap-3">
                            <dt className="text-tertiary">Poster avg response</dt>
                            <dd className="text-secondary">{formatResponseTime(claim.poster_avg_response_seconds)}</dd>
                        </div>
                    )}
                </dl>

                {errorLine}

                {!isCancelled && (
                    <div className="mt-2 flex flex-col gap-3">
                        <button type="button" onClick={() => setMode("confirmCancel")} className={SECONDARY_BTN}>
                            Cancel claim
                        </button>
                    </div>
                )}
            </>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-claim-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {body}
            </motion.div>
        </div>
    );
}
