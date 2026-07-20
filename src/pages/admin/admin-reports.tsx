import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { AdminReportCard, type AdminReportRow, type ReportPostTarget, type ReportUserTarget } from "./admin-report-card";
import { AdminReportDetailSheet } from "./admin-report-detail-sheet";

type ReportStatus = "pending" | "dismissed" | "actioned";

const TABS: { key: ReportStatus; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "dismissed", label: "Dismissed" },
    // 'actioned' reports are ones where the admin removed the post / suspended the user.
    { key: "actioned", label: "Removed" },
];

export function AdminReports() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<ReportStatus>("pending");
    const [reports, setReports] = useState<AdminReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [detailReport, setDetailReport] = useState<AdminReportRow | null>(null);
    const [actioningId, setActioningId] = useState<string | null>(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from("reports")
            .select("id, target_type, target_id, reason, note, status, reviewed_at, created_at")
            .eq("status", activeTab);
        // The Removed tab lists removed posts only; suspended users live in the Users tab.
        if (activeTab === "actioned") query = query.eq("target_type", "post");
        const { data, error: reportsErr } = await query.order("created_at", { ascending: false });

        if (reportsErr) {
            setError(reportsErr.message);
            setReports([]);
            setLoading(false);
            return;
        }

        const rows = (data as AdminReportRow[]) ?? [];

        // Targets aren't snapshotted on the report — resolve them live from target_id.
        const postIds = rows.filter((r) => r.target_type === "post").map((r) => r.target_id);
        const userIds = rows.filter((r) => r.target_type === "user").map((r) => r.target_id);

        const postMap = new Map<string, ReportPostTarget>();
        if (postIds.length > 0) {
            const { data: posts } = await supabase
                .from("posts")
                .select("id, location, custom_court, game_date, status")
                .in("id", postIds);
            for (const p of (posts as ({ id: string } & ReportPostTarget)[]) ?? []) postMap.set(p.id, p);
        }

        const userMap = new Map<string, ReportUserTarget>();
        if (userIds.length > 0) {
            const { data: users } = await supabase.from("users").select("id, first_name, last_name, email").in("id", userIds);
            for (const u of (users as ({ id: string } & ReportUserTarget)[]) ?? []) userMap.set(u.id, u);
        }

        setReports(
            rows.map((r) => ({
                ...r,
                postTarget: r.target_type === "post" ? postMap.get(r.target_id) : undefined,
                userTarget: r.target_type === "user" ? userMap.get(r.target_id) : undefined,
            })),
        );
        setLoading(false);
    }, [activeTab]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // After a moderation action: drop the report from the current list and close the sheet.
    const afterAction = (reportId: string) => {
        setActioningId(null);
        setDetailReport(null);
        setReports((prev) => prev.filter((r) => r.id !== reportId));
    };

    const reviewPatch = (extra: Record<string, unknown>) => ({
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
        ...extra,
    });

    const handleDismiss = async (report: AdminReportRow) => {
        if (!user) return;
        setActioningId(report.id);
        const { error: err } = await supabase.from("reports").update(reviewPatch({ status: "dismissed" })).eq("id", report.id);
        if (err) return void (setError(`Failed to dismiss report: ${err.message}`), setActioningId(null));
        afterAction(report.id);
    };

    const handleRemoveContent = async (report: AdminReportRow) => {
        if (!user) return;
        setActioningId(report.id);
        try {
            // Remove the offending content: soft-delete the post, or suspend the user.
            if (report.target_type === "post") {
                const { error: e } = await supabase.from("posts").update({ status: "deleted" }).eq("id", report.target_id);
                if (e) throw e;
            } else {
                const { error: e } = await supabase.from("users").update({ is_suspended: true }).eq("id", report.target_id);
                if (e) throw e;
            }

            const note = report.note ? `${report.note}\n[Admin: Content removed]` : "[Admin: Content removed]";
            const { error: e2 } = await supabase.from("reports").update(reviewPatch({ status: "actioned", note })).eq("id", report.id);
            if (e2) throw e2;

            // Notify the reported user by email (post author, or the reported user).
            let email = report.userTarget?.email ?? null;
            if (report.target_type === "post") {
                const { data: post } = await supabase.from("posts").select("author_id").eq("id", report.target_id).single();
                if (post?.author_id) {
                    const { data: author } = await supabase.from("users").select("email").eq("id", post.author_id).single();
                    email = author?.email ?? null;
                }
            }
            if (email) {
                const targetLabel = report.target_type === "post" ? "post" : "account";
                await supabase.functions.invoke("send-email", {
                    body: {
                        to: email,
                        subject: "CourtPlay community guidelines notice",
                        html: `<p>Your ${targetLabel} was removed for violating our community guidelines. If you believe this was an error, please contact support.</p>`,
                    },
                });
            }
            afterAction(report.id);
        } catch (err) {
            setError(`Failed to remove content: ${err instanceof Error ? err.message : "Something went wrong."}`);
            setActioningId(null);
        }
    };

    const handleReactivate = async (report: AdminReportRow) => {
        if (!user) return;
        setActioningId(report.id);
        // Restore the removed post to the feed.
        const { error: e } = await supabase
            .from("posts")
            .update({ status: "active", deleted_at: null, deleted_by: null })
            .eq("id", report.target_id);
        if (e) return void (setError(`Failed to reactivate post: ${e.message}`), setActioningId(null));
        // The removal is undone — send the report back to Pending for re-review (clear the review stamp).
        const note = report.note ? `${report.note}\n[Admin: Post reactivated]` : "[Admin: Post reactivated]";
        const { error: e2 } = await supabase
            .from("reports")
            .update({ status: "pending", reviewed_by: null, reviewed_at: null, note })
            .eq("id", report.id);
        if (e2) return void (setError(`Failed to reactivate post: ${e2.message}`), setActioningId(null));
        afterAction(report.id);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Status pills (Activity-tab style) */}
            <div className="flex gap-2">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className={cx(
                            "rounded-full px-3.5 py-1 text-xs font-semibold transition duration-100 ease-linear",
                            activeTab === t.key ? "bg-brand-500 text-neutral-950" : "bg-tertiary text-secondary hover:text-primary",
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="size-6 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-sm text-error-primary">{error}</p>
                    <Button size="sm" color="primary" onClick={fetchReports}>
                        Retry
                    </Button>
                </div>
            ) : reports.length === 0 ? (
                <p className="py-16 text-center text-sm text-tertiary">
                    No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} reports.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {reports.map((report) => (
                        <AdminReportCard key={report.id} report={report} onOpen={setDetailReport} />
                    ))}
                </div>
            )}

            {detailReport && (
                <AdminReportDetailSheet
                    report={detailReport}
                    actioning={actioningId === detailReport.id}
                    onDismiss={() => handleDismiss(detailReport)}
                    onRemoveContent={() => handleRemoveContent(detailReport)}
                    onReactivate={() => handleReactivate(detailReport)}
                    onClose={() => setDetailReport(null)}
                />
            )}
        </div>
    );
}
