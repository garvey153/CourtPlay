import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { supabase } from "@/lib/supabase";

// Themed field surface — bg-tertiary fill with a neutral-600 ring — matching the
// create-post form (Figma 145:1006). Applied to the Input wrapper and, via
// textAreaClassName, to the details TextArea so both read as bg-tertiary fields.
const FIELD = "bg-tertiary ring-neutral-600";

interface FeedbackSheetProps {
    onClose: () => void;
}

/**
 * "Submit Feedback" bottom sheet (reached from the Profile footer). Sheet surface,
 * field styling, and blurred backdrop follow the create-post form / filter sheets.
 * Transitions to a confirmation state on submit: inserts via the submit_feedback
 * RPC, then fires notify-feedback to alert admins (push/email); the in-feed admin
 * banner is driven separately off the table.
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
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-sheet-title"
        >
            <div className="w-full max-w-sm rounded-t-2xl bg-secondary p-6 shadow-xl sm:rounded-2xl">
                {submitted ? (
                    <div className="text-center">
                        <h2 className="text-lg font-semibold text-primary">Got it. Thanks!</h2>
                        <p className="mt-2 text-sm text-tertiary">We actually read these. Promise.</p>
                        <Button color="primary" size="md" className="mt-5 w-full" onClick={onClose}>
                            Done
                        </Button>
                    </div>
                ) : (
                    <>
                        <h2 id="feedback-sheet-title" className="text-lg font-semibold text-primary">
                            Tell us what we broke
                        </h2>
                        <p className="mt-1 text-sm text-tertiary">
                            …or what you wish we'd build. Bugs, ideas, wild dreams — all welcome.
                        </p>

                        <div className="mt-4 flex flex-col gap-4">
                            <Input
                                label="Title"
                                placeholder="Sum it up"
                                value={title}
                                onChange={setTitle}
                                size="sm"
                                wrapperClassName={FIELD}
                                isRequired
                            />
                            <TextArea
                                label="Details"
                                placeholder="The more detail, the better (we won't take it personally)"
                                value={details}
                                onChange={(v) => setDetails(v)}
                                rows={4}
                                textAreaClassName={FIELD}
                            />
                        </div>

                        {error && <p className="mt-2 text-sm text-error-primary">{error}</p>}

                        {/* Stacked full-width actions (Figma 145:1006): primary on top, Cancel below. */}
                        <div className="mt-5 flex flex-col gap-3">
                            <Button
                                color="primary"
                                size="md"
                                className="w-full"
                                onClick={handleSubmit}
                                isLoading={submitting}
                                showTextWhileLoading
                                isDisabled={!title.trim()}
                            >
                                Submit
                            </Button>
                            <Button color="secondary" size="md" className="w-full" onClick={onClose} isDisabled={submitting}>
                                Cancel
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
