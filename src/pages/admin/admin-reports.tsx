import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { AdminReportCard, type AdminReportRow, type ReportPostTarget, type ReportUserTarget } from "./admin-report-card";
import { AdminReportDetailSheet } from "./admin-report-detail-sheet";
import { AdminFeedbackCard, type AdminFeedbackRow } from "./admin-feedback-card";
import { AdminFeedbackDetailSheet } from "./admin-feedback-detail-sheet";
import { LoadingState } from "@/components/application/loading-indicator/spinner";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";

type ReportStatus = "pending" | "dismissed" | "actioned";
// The Feedback section shares the pill row but reads a different table.
type Tab = ReportStatus | "feedback";

const TABS: { key: Tab; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "dismissed", label: "Dismissed" },
    // 'actioned' reports are ones where the admin removed the post / suspended the user.
    { key: "actioned", label: "Removed" },
    { key: "feedback", label: "Feedback" },
];

export function AdminReports() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    // Deep-link: /admin?tab=reports&section=feedback opens straight to the Feedback pill.
    const [activeTab, setActiveTab] = useState<Tab>(searchParams.get("section") === "feedback" ? "feedback" : "pending");
    const [reports, setReports] = useState<AdminReportRow[]>([]);
    const [feedback, setFeedback] = useState<AdminFeedbackRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [detailReport, setDetailReport] = useState<AdminReportRow | null>(null);
    const [detailFeedback, setDetailFeedback] = useState<AdminFeedbackRow | null>(null);
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);

    const fetchFeedback = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        setError(null);
        const { data, error: fbErr } = await supabase
            .from("feedback")
            .select("id, title, details, created_at, users:user_id(first_name, last_name)")
            .order("created_at", { ascending: false });
        if (fbErr) {
            setError(fbErr.message);
            setFeedback([]);
            setLoading(false);
            return;
        }
        setFeedback(
            ((data as unknown as { id: string; title: string; details: string | null; created_at: string; users: { first_name: string | null; last_name: string | null } | null }[]) ?? []).map((r) => ({
                id: r.id,
                title: r.title,
                details: r.details,
                created_at: r.created_at,
                submitter_name: [r.users?.first_name, r.users?.last_name].filter(Boolean).join(" "),
            })),
        );
        setLoading(false);
    }, []);

    const handleDeleteFeedback = async (item: AdminFeedbackRow) => {
        setDeletingFeedbackId(item.id);
        const { error: delErr } = await supabase.from("feedback").delete().eq("id", item.id);
        if (delErr) {
            setError(`Failed to delete feedback: ${delErr.message}`);
            setDeletingFeedbackId(null);
            return;
        }
        setFeedback((prev) => prev.filter((f) => f.id !== item.id));
        setDeletingFeedbackId(null);
        setDetailFeedback(null);
    };

    const fetchReports = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
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
        if (activeTab === "feedback") fetchFeedback();
        else fetchReports();
    }, [activeTab, fetchFeedback, fetchReports]);

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

            // Notify the reported user by email. The recipient and the copy are
            // both resolved server-side from the report — the browser no longer
            // gets to name an address or write the body, because that required
            // send-email to accept a user token and made it an open relay for
            // anyone holding the anon key.
            const { error: notifyError } = await supabase.functions.invoke("notify-content-removed", {
                body: { report_id: report.id },
            });
            if (notifyError) {
                console.warn("Content-removal notice failed:", notifyError.message);
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
        <>
        <div className="flex flex-1 flex-col gap-4">
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
            <PullToRefresh onRefresh={() => (activeTab === "feedback" ? fetchFeedback({ silent: true }) : fetchReports({ silent: true }))} className="flex flex-1 flex-col" contentClassName="flex flex-1 flex-col">
            {loading ? (
                <LoadingState variant="grow" size="md" />
            ) : error ? (
                <ErrorState variant="grow" message={error} onRetry={() => (activeTab === "feedback" ? fetchFeedback() : fetchReports())} />
            ) : activeTab === "feedback" ? (
                feedback.length === 0 ? (
                    <EmptyState variant="grow" title="No feedback yet." />
                ) : (
                    <div className="flex flex-col gap-3">
                        {feedback.map((item) => (
                            <AdminFeedbackCard key={item.id} feedback={item} onOpen={setDetailFeedback} />
                        ))}
                    </div>
                )
            ) : reports.length === 0 ? (
                <EmptyState variant="grow" title={`No ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} reports.`} />
            ) : (
                <div className="flex flex-col gap-3">
                    {reports.map((report) => (
                        <AdminReportCard key={report.id} report={report} onOpen={setDetailReport} />
                    ))}
                </div>
            )}

            </PullToRefresh>
        </div>

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

            {detailFeedback && (
                <AdminFeedbackDetailSheet
                    feedback={detailFeedback}
                    deleting={deletingFeedbackId === detailFeedback.id}
                    onDelete={() => handleDeleteFeedback(detailFeedback)}
                    onClose={() => setDetailFeedback(null)}
                />
            )}
        </>
    );
}
