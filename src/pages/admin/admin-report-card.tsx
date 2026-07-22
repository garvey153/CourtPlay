/** A post the report points at (resolved live from `target_id`). */
export interface ReportPostTarget {
    location: string | null;
    custom_court: string | null;
    game_date: string | null;
    status: string;
}

/** A user the report points at (resolved live from `target_id`). */
export interface ReportUserTarget {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
}

/** Flat shape the admin Reports tab feeds each card: a report joined to its target. */
export interface AdminReportRow {
    id: string;
    target_type: "post" | "user";
    target_id: string;
    reason: string; // spam | inappropriate | incorrect_info | other
    note: string | null;
    status: "pending" | "dismissed" | "actioned";
    reviewed_at: string | null;
    created_at: string;
    postTarget?: ReportPostTarget;
    userTarget?: ReportUserTarget;
}

const REASON_LABELS: Record<string, string> = {
    spam: "Spam",
    inappropriate: "Inappropriate content",
    incorrect_info: "Incorrect information",
    other: "Other",
};

/** Human label for a report reason (falls back to the raw value). */
export function reasonLabel(reason: string): string {
    return REASON_LABELS[reason] ?? reason;
}

/** The court name a post report points at. */
export function reportCourtName(post?: ReportPostTarget): string {
    return post?.location || post?.custom_court || "Unknown court";
}

/** The user name a user report points at. */
export function reportUserName(user?: ReportUserTarget): string {
    if (!user) return "Unknown user";
    return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown user";
}

/** "Post · Compo Beach Tennis" / "User · Jane D." — what/who was reported. */
export function reportTargetLabel(report: AdminReportRow): string {
    return report.target_type === "post"
        ? `Post · ${reportCourtName(report.postTarget)}`
        : `User · ${reportUserName(report.userTarget)}`;
}

function formatTimestamp(dateStr: string): string {
    // toLocaleString (not toLocaleDateString) → comma-separated "April 7, 2026, 4:48 PM" per design.
    return new Date(dateStr).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

interface AdminReportCardProps {
    report: AdminReportRow;
    /** Tapping the card opens the report detail/actions sheet. */
    onOpen: (report: AdminReportRow) => void;
}

/** Feed-style report card for the admin Reports tab (design 149:1331). */
export function AdminReportCard({ report, onOpen }: AdminReportCardProps) {
    return (
        <button type="button" onClick={() => onOpen(report)} className="w-full text-left">
            <div className="flex flex-col gap-3 rounded bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                {/* When + what/who was reported */}
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-xs text-secondary">{formatTimestamp(report.created_at)}</p>
                    <p className="truncate text-md font-semibold text-primary">{reportTargetLabel(report)}</p>
                </div>

                {/* Reporter's note */}
                <div className="rounded-lg border border-tertiary px-3 py-2.5">
                    <p className={report.note ? "text-sm text-secondary" : "text-sm italic text-tertiary"}>
                        {report.note || "No details provided"}
                    </p>
                </div>

                <p className="text-xs text-secondary">Reason: {reasonLabel(report.reason)}</p>
            </div>
        </button>
    );
}
