import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { supabase } from "@/lib/supabase";

// Field fill matches the other themed forms (lighter than the sheet surface).
const FIELD_WRAPPER = "bg-tertiary ring-neutral-600";

interface FeedbackSheetProps {
    onClose: () => void;
}

/**
 * "Submit Feedback" bottom sheet (reached from the Profile footer). Title +
 * details form that transitions to a confirmation state on submit, matching the
 * report-modal pattern and the app's other bottom sheets. On submit it inserts
 * via the submit_feedback RPC, then fires notify-feedback to alert admins
 * (push/email); the in-feed admin banner is driven separately off the table.
 */
export function FeedbackSheet({ onClose }: FeedbackSheetProps) {
    const [title, setTitle] = useState("");
    const [details, setDetails] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const handleBackdrop = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    const handleSubmit = useCallback(async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc("submit_feedback", {
            p_title: title.trim(),
            p_details: details.trim() || null,
        });

        if (rpcError) {
            setSubmitting(false);
            setError("Couldn't submit your feedback. Please try again.");
            return;
        }

        // Alert admins (push + email). Fire-and-forget — don't block the confirmation.
        if (data) {
            supabase.functions.invoke("notify-feedback", { body: { feedback_id: data } }).catch(() => {});
        }

        setSubmitting(false);
        setSubmitted(true);
    }, [title, details]);

    return (
        <div
            ref={overlayRef}
            onMouseDown={handleBackdrop}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-sheet-title"
        >
            <div className="w-full max-w-sm rounded-t-2xl bg-primary p-6 shadow-xl sm:rounded-2xl">
                {submitted ? (
                    <div className="text-center">
                        <h2 className="text-lg font-semibold text-primary">Thanks for the feedback!</h2>
                        <p className="mt-2 text-sm text-tertiary">
                            We've shared it with the team. We appreciate you helping make CourtPlay better.
                        </p>
                        <Button color="primary" size="md" className="mt-5 w-full" onClick={onClose}>
                            Done
                        </Button>
                    </div>
                ) : (
                    <>
                        <h2 id="feedback-sheet-title" className="text-lg font-semibold text-primary">
                            Submit feedback
                        </h2>
                        <p className="mt-1 text-sm text-tertiary">
                            Found a bug or have an idea? Tell us — we read everything.
                        </p>

                        <div className="mt-4 flex flex-col gap-4">
                            <Input
                                label="Title"
                                placeholder="Summarize it in a few words"
                                value={title}
                                onChange={setTitle}
                                size="sm"
                                wrapperClassName={FIELD_WRAPPER}
                                isRequired
                            />
                            <TextArea
                                label="Details"
                                placeholder="Share as much as you'd like…"
                                value={details}
                                onChange={(v) => setDetails(v)}
                                rows={4}
                            />
                        </div>

                        {error && <p className="mt-2 text-sm text-error-primary">{error}</p>}

                        <div className="mt-5 flex gap-3">
                            <Button color="secondary" size="md" className="flex-1" onClick={onClose} isDisabled={submitting}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                size="md"
                                className="flex-1"
                                onClick={handleSubmit}
                                isLoading={submitting}
                                showTextWhileLoading
                                isDisabled={!title.trim()}
                            >
                                Submit
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
