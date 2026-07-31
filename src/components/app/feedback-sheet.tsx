import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/application/loading-indicator/spinner";

// Themed field surface — bg-tertiary fill with a neutral-600 ring — matching the
// create-post form (Figma 145:1006). Applied to the Input wrapper and, via
// textAreaClassName, to the details TextArea.
const FIELD = "bg-tertiary ring-neutral-600";

// Action buttons match the create-post form: flat brand primary + flat bg-tertiary
// secondary (the base Button's secondary variant uses a ring, which is wrong here).
const PRIMARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50";


interface FeedbackSheetProps {
    onClose: () => void;
}

/**
 * "Submit Feedback" bottom sheet (reached from the Profile footer). Sheet surface,
 * width, header/close, field styling, button styling, and blurred+dimmed backdrop
 * follow the app's bottom-sheet pattern (filter sheets / create-post form). On
 * submit it inserts via the submit_feedback RPC, then fires notify-feedback to
 * alert admins; the in-feed admin banner is driven separately off the table.
 */
export function FeedbackSheet({ onClose }: FeedbackSheetProps) {
    const [title, setTitle] = useState("");
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

        // Alert admins (push + email). Fire-and-forget — the feedback is already
        // saved, so a failed fan-out must not fail the submission for the player.
        // It still gets logged: `invoke` resolves with an `error` rather than
        // rejecting, so the old bare `.catch()` swallowed every fan-out failure
        // and left the browser with no trace of one.
        if (data) {
            supabase.functions
                .invoke("notify-feedback", { body: { feedback_id: data } })
                .then(({ data: fanout, error: fanoutError }) => {
                    if (fanoutError || !fanout?.ok) {
                        console.error("[feedback] admin fan-out failed", fanoutError ?? fanout);
                    }
                })
                .catch((e) => console.error("[feedback] admin fan-out threw", e));
        }

        setSubmitting(false);
        setSubmitted(true);
    }, [title, details]);

    // Portaled to <body> and slides up, consistent with the report/detail sheets.
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-sheet-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Full-width on mobile (no side margins), capped and centered on larger
                screens. pb-8 matches the filter sheets' footer spacing. */}
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
                        <h2 className="pr-9 text-lg font-semibold text-primary">Got it. Thanks!</h2>
                        <p className="mt-1 text-sm text-tertiary">We actually read these. Promise.</p>
                        <button type="button" className={`${PRIMARY_BTN} mt-8`} onClick={onClose}>
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 id="feedback-sheet-title" className="pr-9 text-lg font-semibold text-primary">
                            Submit feedback
                        </h2>
                        <p className="mt-1 text-sm text-tertiary">Bugs, ideas, gripes… We read every one.</p>

                        <div className="mt-4 flex flex-col gap-4">
                            <Input
                                label="Title"
                                placeholder="Give it a headline"
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
                                size="sm"
                                textAreaClassName={FIELD}
                            />
                        </div>

                        {error && <p className="mt-2 text-sm text-error-primary">{error}</p>}

                        {/* 32px above the actions; stacked full-width, primary on top. */}
                        <div className="mt-8 flex flex-col gap-3">
                            <button type="button" className={PRIMARY_BTN} onClick={handleSubmit} disabled={submitting || !title.trim()}>
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
