import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { TextArea } from "@/components/base/textarea/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { FIELD } from "@/components/base/input/field-styles";
import { PRIMARY_SM_FULL as PRIMARY_BTN, SECONDARY_SM_FULL_HOVERFILL as SECONDARY_BTN } from "@/components/base/buttons/button-styles";

export type ReportReason = "spam" | "inappropriate" | "incorrect_info" | "other";
export type ReportTargetType = "post" | "user";

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
    { value: "spam", label: "Spam" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "incorrect_info", label: "Incorrect information" },
    { value: "other", label: "Other" },
];

// Themed field surface — matches the create-post form and the feedback sheet.

// Flat button styles shared with the other bottom sheets.


interface ReportModalProps {
    targetType: ReportTargetType;
    targetId: string;
    onClose: () => void;
}

export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
    const { user } = useAuth();
    // Spam is preselected so the form is submittable by default.
    const [reason, setReason] = useState<ReportReason>("spam");
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

    // Portaled to <body> so the fixed overlay + backdrop-blur escape any sheet this
    // is opened from (the detail sheets are transformed motion.div's, which break
    // position:fixed and backdrop-filter). Slides up like the other bottom sheets.
    return createPortal(
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
            <motion.div
                className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
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

                        {/* Rows match the filter sheet's checkbox rows: h-9 bg-tertiary rows
                            grouped with 4px gaps and only the outer corners rounded. The
                            indicator is a radio dot (single-select), not a checkbox. */}
                        <fieldset className="mt-4">
                            <legend className="sr-only">Report reason</legend>
                            <div className="flex flex-col gap-1 overflow-hidden rounded-lg">
                                {REASON_OPTIONS.map((opt) => {
                                    const selected = reason === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setReason(opt.value)}
                                            aria-pressed={selected}
                                            className="flex h-9 w-full items-center gap-2 bg-tertiary px-3 text-left transition duration-100 ease-linear hover:brightness-110"
                                        >
                                            <span
                                                className={cx(
                                                    "flex size-4 shrink-0 items-center justify-center rounded-full",
                                                    selected ? "bg-brand-500" : "border border-neutral-200",
                                                )}
                                            >
                                                {selected && <span className="size-1.5 rounded-full bg-white" />}
                                            </span>
                                            <span className="min-w-0 truncate text-sm text-secondary">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <div className="mt-5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-secondary">Additional details (optional)</span>
                                <span className="text-xs text-tertiary">{note.length}/150</span>
                            </div>
                            <TextArea
                                aria-label="Additional details"
                                placeholder="Tell us more..."
                                value={note}
                                onChange={(v) => setNote(v)}
                                maxLength={150}
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
                                disabled={submitting}
                            >
                                {submitting ? <Spinner size="sm" tone="on-brand" /> : "Submit report"}
                            </button>
                            <button type="button" className={SECONDARY_BTN} onClick={onClose} disabled={submitting}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>,
        document.body,
    );
}
