import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trash01, XClose } from "@untitledui/icons";
import type { AdminFeedbackRow } from "./admin-feedback-card";

const PRIMARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const DELETE_BTN =
    "flex w-full items-center justify-center gap-1.5 rounded-lg bg-error-solid px-4 py-2.5 text-sm font-semibold text-white transition duration-100 ease-linear enabled:hover:bg-error-solid_hover disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
);

function formatTimestamp(dateStr: string): string {
    return new Date(dateStr).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

interface AdminFeedbackDetailSheetProps {
    feedback: AdminFeedbackRow;
    deleting: boolean;
    onDelete: () => void;
    onClose: () => void;
}

/** Admin detail sheet for a single feedback submission — review it and Delete (with a confirm step). */
export function AdminFeedbackDetailSheet({ feedback, deleting, onDelete, onClose }: AdminFeedbackDetailSheetProps) {
    // "confirm" swaps the body for a delete confirmation (like the report sheet).
    const [mode, setMode] = useState<"view" | "confirm">("view");

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-feedback-sheet-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                className="relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h2 id="admin-feedback-sheet-title" className="text-md font-semibold text-primary">
                            {feedback.title}
                        </h2>
                        <p className="truncate text-xs text-tertiary">
                            {formatTimestamp(feedback.created_at)}
                            {feedback.submitter_name ? ` · ${feedback.submitter_name}` : ""}
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
                    <div className="mt-1 flex shrink-0 flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-md font-semibold text-primary">Delete this feedback?</h3>
                            <p className="text-sm text-secondary">This permanently removes it and can't be undone.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button type="button" onClick={onDelete} disabled={deleting} className={DELETE_BTN}>
                                {deleting ? (
                                    <ButtonSpinner />
                                ) : (
                                    <>
                                        <Trash01 className="size-4" aria-hidden="true" />
                                        Yes, delete
                                    </>
                                )}
                            </button>
                            <button type="button" onClick={() => setMode("view")} disabled={deleting} className={SECONDARY_BTN}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Details */}
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-tertiary px-3 py-2.5">
                            <p className={feedback.details ? "text-sm whitespace-pre-wrap text-secondary" : "text-sm italic text-tertiary"}>
                                {feedback.details || "No details provided"}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="mt-1 flex shrink-0 flex-col gap-3">
                            <button type="button" onClick={() => setMode("confirm")} className={PRIMARY_BTN}>
                                Delete
                            </button>
                            <button type="button" onClick={onClose} className={SECONDARY_BTN}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
