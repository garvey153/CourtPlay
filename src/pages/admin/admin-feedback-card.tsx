import { Trash01 } from "@untitledui/icons";

/** A feedback submission shown in the admin Reports → Feedback section. */
export interface AdminFeedbackRow {
    id: string;
    title: string;
    details: string | null;
    created_at: string;
    submitter_name: string;
}

function formatTimestamp(dateStr: string): string {
    return new Date(dateStr).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

interface AdminFeedbackCardProps {
    feedback: AdminFeedbackRow;
    deleting: boolean;
    onDelete: (feedback: AdminFeedbackRow) => void;
}

/** Feed-style feedback card for the admin Reports → Feedback section. */
export function AdminFeedbackCard({ feedback, deleting, onDelete }: AdminFeedbackCardProps) {
    return (
        <div className="flex flex-col gap-3 rounded bg-secondary p-4">
            {/* When + who + title */}
            <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-xs text-secondary">
                    {formatTimestamp(feedback.created_at)}
                    {feedback.submitter_name ? ` · ${feedback.submitter_name}` : ""}
                </p>
                <p className="text-md font-semibold text-primary">{feedback.title}</p>
            </div>

            {/* Details */}
            <div className="rounded-lg border border-tertiary px-3 py-2.5">
                <p className={feedback.details ? "text-sm whitespace-pre-wrap text-secondary" : "text-sm italic text-tertiary"}>
                    {feedback.details || "No details provided"}
                </p>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => onDelete(feedback)}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-error-primary transition duration-100 ease-linear hover:opacity-80 disabled:opacity-50"
                >
                    <Trash01 className="size-4" aria-hidden="true" />
                    {deleting ? "Deleting…" : "Delete"}
                </button>
            </div>
        </div>
    );
}
