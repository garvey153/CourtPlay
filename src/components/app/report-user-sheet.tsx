import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { TextArea } from "@/components/base/textarea/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { FIELD } from "@/components/base/input/field-styles";
import { PRIMARY_SM_FULL as PRIMARY_BTN, SECONDARY_SM_FULL as SECONDARY_BTN } from "@/components/base/buttons/button-styles";

// Themed field surface — matches the create-post form and the feedback sheet.

// Flat button styles shared with the feedback / report sheets.


interface ReportUserSheetProps {
    /** The reported user's id. */
    targetId: string;
    onClose: () => void;
}

/**
 * "Report this user" bottom sheet. Follows the Submit Feedback sheet's design —
 * title, subtext, a single Details field, and stacked Submit / Cancel actions —
 * rather than a reason picker. The prose subtext names the kinds of things worth
 * flagging; the free-text detail lands in reports.note (reason stays "other").
 */
export function ReportUserSheet({ targetId, onClose }: ReportUserSheetProps) {
    const { user } = useAuth();
    const [details, setDetails] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const handleSubmit = useCallback(async () => {
        if (!user || !details.trim()) return;
        setSubmitting(true);
        setError(null);

        const { error: insertError } = await supabase.from("reports").insert({
            reporter_id: user.id,
            target_type: "user",
            target_id: targetId,
            reason: "other",
            note: details.trim(),
        });

        setSubmitting(false);

        if (insertError) {
            setError("Couldn't submit your report. Please try again.");
            return;
        }

        setSubmitted(true);
    }, [user, targetId, details]);

    // Portaled to <body> and slides up, consistent with the feedback / report sheets.
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-user-sheet-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
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
                        <p className="mt-1 text-sm text-tertiary">Thanks for the heads-up. Our team will take a look.</p>
                        <button type="button" className={`${PRIMARY_BTN} mt-8`} onClick={onClose}>
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 id="report-user-sheet-title" className="pr-9 text-lg font-semibold text-primary">
                            Report this user
                        </h2>
                        <p className="mt-1 text-sm text-tertiary">
                            Spam, harassment, a fake profile, or just plain sketchy? Tell us what happened — reports are anonymous.
                        </p>

                        <div className="mt-4">
                            <TextArea
                                label="Details"
                                placeholder="What's going on? The more we know, the faster we can act."
                                value={details}
                                onChange={(v) => setDetails(v)}
                                rows={4}
                                size="sm"
                                maxLength={500}
                                textAreaClassName={FIELD}
                            />
                        </div>

                        {error && <p className="mt-2 text-sm text-error-primary">{error}</p>}

                        {/* 32px above the actions; stacked full-width, Submit on top. */}
                        <div className="mt-8 flex flex-col gap-3">
                            <button
                                type="button"
                                aria-label="Submit report"
                                className={PRIMARY_BTN}
                                onClick={handleSubmit}
                                disabled={submitting || !details.trim()}
                            >
                                {submitting ? <Spinner size="sm" tone="on-brand" /> : "Submit"}
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
