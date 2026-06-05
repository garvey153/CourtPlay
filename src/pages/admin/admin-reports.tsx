import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type ReportStatus = "pending" | "dismissed" | "actioned";

interface Report {
    id: string;
    reporter_id: string;
    target_type: "post" | "user";
    target_id: string;
    reason: string;
    note: string | null;
    status: ReportStatus;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
}

interface PostTarget {
    id: string;
    court_name: string | null;
    game_date: string | null;
    status: string;
}

interface UserTarget {
    id: string;
    full_name: string | null;
    email: string | null;
}

interface ReporterInfo {
    id: string;
    full_name: string | null;
}

interface EnrichedReport extends Report {
    reporter?: ReporterInfo;
    postTarget?: PostTarget;
    userTarget?: UserTarget;
}

const TABS: { key: ReportStatus; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "dismissed", label: "Dismissed" },
    { key: "actioned", label: "Actioned" },
];

export function AdminReports() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<ReportStatus>("pending");
    const [reports, setReports] = useState<EnrichedReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("reports")
                .select(
                    "id, reporter_id, target_type, target_id, reason, note, status, reviewed_by, reviewed_at, created_at",
                )
                .eq("status", activeTab)
                .order("created_at", { ascending: false });

            if (error) throw error;
            if (!data) {
                setReports([]);
                return;
            }

            // Collect IDs for batch fetching
            const reporterIds = [...new Set(data.map((r) => r.reporter_id))];
            const postIds = data.filter((r) => r.target_type === "post").map((r) => r.target_id);
            const userIds = data.filter((r) => r.target_type === "user").map((r) => r.target_id);

            // Fetch reporters
            const { data: reporters } = await supabase
                .from("users")
                .select("id, full_name")
                .in("id", reporterIds);

            // Fetch post targets
            let posts: PostTarget[] = [];
            if (postIds.length > 0) {
                const { data: postData } = await supabase
                    .from("posts")
                    .select("id, court_name, game_date, status")
                    .in("id", postIds);
                posts = (postData as PostTarget[]) ?? [];
            }

            // Fetch user targets
            let users: UserTarget[] = [];
            if (userIds.length > 0) {
                const { data: userData } = await supabase
                    .from("users")
                    .select("id, full_name, email")
                    .in("id", userIds);
                users = (userData as UserTarget[]) ?? [];
            }

            const reporterMap = new Map((reporters ?? []).map((r) => [r.id, r as ReporterInfo]));
            const postMap = new Map(posts.map((p) => [p.id, p]));
            const userMap = new Map(users.map((u) => [u.id, u]));

            const enriched: EnrichedReport[] = data.map((report) => ({
                ...report,
                target_type: report.target_type as "post" | "user",
                reporter: reporterMap.get(report.reporter_id),
                postTarget:
                    report.target_type === "post" ? postMap.get(report.target_id) : undefined,
                userTarget:
                    report.target_type === "user" ? userMap.get(report.target_id) : undefined,
            }));

            setReports(enriched);
        } catch (err) {
            console.error("Failed to fetch reports:", err);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    async function handleDismiss(reportId: string) {
        if (!user) return;
        setActioningId(reportId);
        try {
            const { error } = await supabase
                .from("reports")
                .update({
                    status: "dismissed",
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", reportId);

            if (error) throw error;
            setReports((prev) => prev.filter((r) => r.id !== reportId));
        } catch (err) {
            console.error("Failed to dismiss report:", err);
        } finally {
            setActioningId(null);
        }
    }

    async function handleRemoveContent(report: EnrichedReport) {
        if (!user) return;
        setActioningId(report.id);
        try {
            if (report.target_type === "post") {
                // Soft-delete the post
                const { error: postErr } = await supabase
                    .from("posts")
                    .update({ status: "deleted" })
                    .eq("id", report.target_id);
                if (postErr) throw postErr;
            } else if (report.target_type === "user") {
                // Suspend the user
                const { error: userErr } = await supabase
                    .from("users")
                    .update({ is_suspended: true })
                    .eq("id", report.target_id);
                if (userErr) throw userErr;
            }

            // Mark report as actioned
            const { error: reportErr } = await supabase
                .from("reports")
                .update({
                    status: "actioned",
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                    note: report.note
                        ? `${report.note}\n[Admin: Content removed]`
                        : "[Admin: Content removed]",
                })
                .eq("id", report.id);
            if (reportErr) throw reportErr;

            // Send email notification to reported user
            let reportedEmail: string | null = null;

            if (report.target_type === "user" && report.userTarget?.email) {
                reportedEmail = report.userTarget.email;
            } else if (report.target_type === "post") {
                // Fetch post author email
                const { data: postData } = await supabase
                    .from("posts")
                    .select("author_id")
                    .eq("id", report.target_id)
                    .single();

                if (postData?.author_id) {
                    const { data: authorData } = await supabase
                        .from("users")
                        .select("email")
                        .eq("id", postData.author_id)
                        .single();
                    reportedEmail = authorData?.email ?? null;
                }
            }

            if (reportedEmail) {
                const targetLabel = report.target_type === "post" ? "post" : "account";
                await supabase.functions.invoke("send-email", {
                    body: {
                        to: reportedEmail,
                        subject: "CourtPlay community guidelines notice",
                        html: `<p>Your ${targetLabel} was removed for violating our community guidelines. If you believe this was an error, please contact support.</p>`,
                    },
                });
            }

            setReports((prev) => prev.filter((r) => r.id !== report.id));
        } catch (err) {
            console.error("Failed to remove content:", err);
        } finally {
            setActioningId(null);
        }
    }

    async function handleEscalate(report: EnrichedReport) {
        if (!user) return;
        setActioningId(report.id);
        try {
            const { error } = await supabase
                .from("reports")
                .update({
                    status: "actioned",
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                    note: report.note
                        ? `${report.note}\n[Admin: Escalated for review]`
                        : "[Admin: Escalated for review]",
                })
                .eq("id", report.id);

            if (error) throw error;
            setReports((prev) => prev.filter((r) => r.id !== report.id));
        } catch (err) {
            console.error("Failed to escalate report:", err);
        } finally {
            setActioningId(null);
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-primary">Reports</h2>

            {/* Status tabs */}
            <div className="flex gap-1 rounded-lg bg-secondary p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition duration-100 ease-linear ${
                            activeTab === t.key
                                ? "bg-primary text-primary shadow-sm"
                                : "text-tertiary hover:text-secondary"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Reports list */}
            {loading ? (
                <p className="py-8 text-center text-sm text-tertiary">Loading reports...</p>
            ) : reports.length === 0 ? (
                <p className="py-8 text-center text-sm text-tertiary">
                    No {activeTab} reports found.
                </p>
            ) : (
                <div className="space-y-3">
                    {reports.map((report) => (
                        <div
                            key={report.id}
                            className="rounded-xl border border-secondary bg-primary p-4 space-y-3"
                        >
                            {/* Header: target type + timestamp */}
                            <div className="flex items-center justify-between">
                                <Badge
                                    color={report.target_type === "post" ? "blue" : "orange"}
                                    size="sm"
                                >
                                    {report.target_type === "post"
                                        ? "Post Report"
                                        : "User Report"}
                                </Badge>
                                <span className="text-xs text-tertiary">
                                    {formatDate(report.created_at)}
                                </span>
                            </div>

                            {/* Target context */}
                            <div className="rounded-lg bg-secondary p-3">
                                {report.target_type === "post" && report.postTarget ? (
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-primary">
                                            Post at {report.postTarget.court_name ?? "Unknown court"}
                                        </p>
                                        <p className="text-xs text-tertiary">
                                            Game date:{" "}
                                            {report.postTarget.game_date
                                                ? new Date(
                                                      report.postTarget.game_date,
                                                  ).toLocaleDateString()
                                                : "N/A"}
                                        </p>
                                        <p className="text-xs text-tertiary">
                                            Status: {report.postTarget.status}
                                        </p>
                                    </div>
                                ) : report.target_type === "user" && report.userTarget ? (
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-primary">
                                            {report.userTarget.full_name ?? "Unknown user"}
                                        </p>
                                        <p className="text-xs text-tertiary">
                                            {report.userTarget.email ?? "No email"}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-tertiary">
                                        Target not found (ID: {report.target_id})
                                    </p>
                                )}
                            </div>

                            {/* Reason + note */}
                            <div className="space-y-1">
                                <p className="text-sm text-primary">
                                    <span className="font-medium">Reason:</span> {report.reason}
                                </p>
                                {report.note && (
                                    <p className="text-sm text-secondary">
                                        <span className="font-medium">Note:</span> {report.note}
                                    </p>
                                )}
                            </div>

                            {/* Reporter identity hidden to preserve anonymity */}

                            {/* Review info for dismissed/actioned */}
                            {report.reviewed_at && (
                                <p className="text-xs text-tertiary">
                                    Reviewed: {formatDate(report.reviewed_at)}
                                </p>
                            )}

                            {/* Actions (pending only) */}
                            {activeTab === "pending" && (
                                <div className="flex gap-2 border-t border-secondary pt-3">
                                    <Button
                                        size="sm"
                                        color="secondary"
                                        isLoading={actioningId === report.id}
                                        isDisabled={actioningId !== null}
                                        onClick={() => handleDismiss(report.id)}
                                    >
                                        Dismiss
                                    </Button>
                                    <Button
                                        size="sm"
                                        color="primary-destructive"
                                        isLoading={actioningId === report.id}
                                        isDisabled={actioningId !== null}
                                        onClick={() => handleRemoveContent(report)}
                                    >
                                        Remove Content
                                    </Button>
                                    <Button
                                        size="sm"
                                        color="tertiary"
                                        isLoading={actioningId === report.id}
                                        isDisabled={actioningId !== null}
                                        onClick={() => handleEscalate(report)}
                                    >
                                        Escalate
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
