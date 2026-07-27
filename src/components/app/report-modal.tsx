import { useCallback, useEffect, useState } from "react";
import { XClose } from "@untitledui/icons";
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

// Themed field surface — matches the create-post form and the feedback sheet.
const FIELD = "bg-tertiary ring-neutral-600";

// Flat button styles shared with the other bottom sheets.
const SECONDARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Full-width on mobile, capped and centered on larger screens. pb-8 matches
                the filter sheets' footer spacing. */}
            <div className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-quaternary transition duration-100 ease-linear hover:text-tertiary"
                >
                    <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
                </button>

                {submitted ? (
                    <div>
                        <h2 className="pr-9 text-lg font-semibold text-primary">Report submitted</h2>
                        <p className="mt-1 text-sm text-tertiary">Thanks for your report. Our team will review it.</p>
                        <button type="button" className={`${PRIMARY_BTN} mt-8`} onClick={onClose}>
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 id="report-modal-title" className="pr-9 text-lg font-semibold text-primary">
                            Report this {label}
                        </h2>
                        <p className="mt-1 text-sm text-tertiary">Select a reason for your report. Reports are anonymous.</p>

                        <fieldset className="mt-4 space-y-2">
                            <legend className="sr-only">Report reason</legend>
                            {REASON_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-tertiary bg-tertiary px-3 py-2.5 transition duration-100 ease-linear has-[:checked]:border-brand has-[:checked]:bg-brand-section_subtle"
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
                                size="sm"
                                textAreaClassName={FIELD}
                            />
                        </div>

                        {error && <p className="mt-2 text-sm text-error-primary">{error}</p>}

                        {/* 32px above the actions; stacked full-width, submit on top. */}
                        <div className="mt-8 flex flex-col gap-3">
                            <button
                                type="button"
                                aria-label="Submit report"
                                className={PRIMARY_BTN}
                                onClick={handleSubmit}
                                disabled={submitting || !reason}
                            >
                                {submitting ? <ButtonSpinner /> : "Submit report"}
                            </button>
                            <button type="button" className={SECONDARY_BTN} onClick={onClose} disabled={submitting}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
