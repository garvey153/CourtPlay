import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import type { FeedPost } from "@/types/feed";

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

interface ClaimModalProps {
    post: FeedPost;
    onClose: () => void;
    onSuccess: (claimId: string) => void;
}

export function ClaimModal({ post, onClose, onSuccess }: ClaimModalProps) {
    const [loading, setLoading] = useState(false);
    const [conflict, setConflict] = useState<{ date: string; time: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on backdrop click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (e.target === overlayRef.current) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    // Trap focus / close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        setConflict(null);

        const { data, error: rpcError } = await supabase.rpc("submit_claim", {
            p_post_id: post.id,
        });

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

        // Notify poster that a claim was submitted (fire-and-forget)
        sendNotification({
            user_id: post.author_id,
            notification_type: "claim_submitted",
            post_id: post.id,
            claim_id: data.claim_id as string,
        });

        onSuccess(data.claim_id as string);
    };

    const locationDisplay = post.location ?? post.custom_court ?? "TBD";
    const dateDisplay = post.game_date ? formatDate(post.game_date) : "Date TBD";
    const timeDisplay = post.game_time ? formatTime(post.game_time) : null;
    const costDisplay = post.cost != null ? `$${post.cost.toFixed(2)}` : "Free";

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-modal-title"
        >
            <div className="w-full max-w-sm rounded-t-2xl bg-primary p-6 shadow-xl sm:rounded-2xl">
                <h2 id="claim-modal-title" className="text-lg font-semibold text-primary">
                    Claim this spot?
                </h2>

                <div className="mt-3 space-y-1 text-sm text-secondary">
                    <p><span className="font-medium text-primary">{locationDisplay}</span></p>
                    <p>
                        {dateDisplay}
                        {timeDisplay && <span className="text-tertiary"> · {timeDisplay}</span>}
                    </p>
                    <p className="font-semibold text-primary">{costDisplay}</p>
                </div>

                <p className="mt-3 text-sm text-tertiary">
                    Your claim will be sent to {post.first_name} for approval. You'll be notified once approved.
                </p>

                {conflict && (
                    <div className="mt-3 rounded-lg bg-warning-primary p-3 text-sm text-primary">
                        You already have a pending claim on{" "}
                        <span className="font-semibold">{formatDate(conflict.date)}</span>{" "}
                        at{" "}
                        <span className="font-semibold">{formatTime(conflict.time)}</span>.
                        Back out of that claim first.
                    </div>
                )}

                {error && (
                    <p className="mt-3 text-sm text-error-primary">{error}</p>
                )}

                <div className="mt-5 flex gap-3">
                    <Button
                        color="secondary"
                        size="md"
                        className="flex-1"
                        onClick={onClose}
                        isDisabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        size="md"
                        className="flex-1"
                        onClick={handleConfirm}
                        isLoading={loading}
                        showTextWhileLoading
                        isDisabled={!!conflict}
                    >
                        Confirm claim
                    </Button>
                </div>
            </div>
        </div>
    );
}
