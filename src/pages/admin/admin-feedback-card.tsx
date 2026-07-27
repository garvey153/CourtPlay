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
    /** Tapping the card opens the feedback detail/delete sheet. */
    onOpen: (feedback: AdminFeedbackRow) => void;
}

/** Feed-style feedback card for the admin Reports → Feedback section. */
export function AdminFeedbackCard({ feedback, onOpen }: AdminFeedbackCardProps) {
    return (
        <button type="button" onClick={() => onOpen(feedback)} className="w-full text-left">
            <div className="flex flex-col gap-3 rounded bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                {/* When + who + title */}
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-xs text-secondary">
                        {formatTimestamp(feedback.created_at)}
                        {feedback.submitter_name ? ` · ${feedback.submitter_name}` : ""}
                    </p>
                    <p className="text-md font-semibold text-primary">{feedback.title}</p>
                </div>

                {/* Details preview */}
                <div className="rounded-lg border border-tertiary px-3 py-2.5">
                    <p className={feedback.details ? "line-clamp-2 text-sm text-secondary" : "text-sm italic text-tertiary"}>
                        {feedback.details || "No details provided"}
                    </p>
                </div>
            </div>
        </button>
    );
}
