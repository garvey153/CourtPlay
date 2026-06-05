import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export type ReportReason = "spam" | "inappropriate" | "incorrect_info" | "other";
export type ReportTargetType = "post" | "user";

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
    { value: "spam", label: "Spam" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "incorrect_info", label: "Incorrect information" },
    { value: "other", label: "Other" },
];

interface ReportModalProps {
    targetType: ReportTargetType;
    targetId: string;
    onClose: () => void;
}

export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
    const { user } = useAuth();
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
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

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleSubmit = useCallback(async () => {
        if (!user || !reason) return;
        setSubmitting(true);
        setError(null);

        const { error: insertError } = await supabase.from("reports").insert({
            reporter_id: user.id,
            target_type: targetType,
            target_id: targetId,
            reason,
            note: note.trim() || null,
        });

        setSubmitting(false);

        if (insertError) {
            setError("Failed to submit report. Please try again.");
            return;
        }

        setSubmitted(true);
    }, [user, targetType, targetId, reason, note]);

    const label = targetType === "post" ? "post" : "user";

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
        >
            <div className="w-full max-w-sm rounded-t-2xl bg-primary p-6 shadow-xl sm:rounded-2xl">
                {submitted ? (
                    <div className="text-center">
                        <h2 className="text-lg font-semibold text-primary">Report submitted</h2>
                        <p className="mt-2 text-sm text-tertiary">
                            Thanks for your report. Our team will review it.
                        </p>
                        <Button color="secondary" size="md" className="mt-5 w-full" onClick={onClose}>
                            Done
                        </Button>
                    </div>
                ) : (
                    <>
                        <h2 id="report-modal-title" className="text-lg font-semibold text-primary">
                            Report this {label}
                        </h2>
                        <p className="mt-1 text-sm text-tertiary">
                            Select a reason for your report. Reports are anonymous.
                        </p>

                        <fieldset className="mt-4 space-y-2">
                            <legend className="sr-only">Report reason</legend>
                            {REASON_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-secondary px-3 py-2.5 transition duration-100 ease-linear has-[:checked]:border-brand has-[:checked]:bg-brand-section_subtle"
                                >
                                    <input
                                        type="radio"
                                        name="report-reason"
                                        value={opt.value}
                                        checked={reason === opt.value}
                                        onChange={() => setReason(opt.value)}
                                        className="size-4 accent-brand-600"
                                    />
                                    <span className="text-sm font-medium text-primary">{opt.label}</span>
                                </label>
                            ))}
                        </fieldset>

                        <div className="mt-4">
                            <TextArea
                                label="Additional details (optional)"
                                placeholder="Tell us more..."
                                value={note}
                                onChange={(v) => setNote(v)}
                                maxLength={150}
                                hint={`${note.length}/150`}
                                rows={3}
                            />
                        </div>

                        {error && <p className="mt-2 text-sm text-error-primary">{error}</p>}

                        <div className="mt-5 flex gap-3">
                            <Button
                                color="secondary"
                                size="md"
                                className="flex-1"
                                onClick={onClose}
                                isDisabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                color="primary-destructive"
                                size="md"
                                className="flex-1"
                                onClick={handleSubmit}
                                isLoading={submitting}
                                showTextWhileLoading
                                isDisabled={!reason}
                            >
                                Submit report
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
