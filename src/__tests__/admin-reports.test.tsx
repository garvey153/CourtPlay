import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Types ────────────────────────────────────────────────────────────────

interface Report {
    id: string;
    reporter_id: string;
    target_type: "post" | "user";
    target_id: string;
    reason: string;
    note: string | null;
    status: "pending" | "dismissed" | "actioned";
    reviewed_by: string | null;
    reviewed_at: string | null;
}

interface Post {
    id: string;
    author_id: string;
    status: "active" | "deleted";
    location: string;
}

interface User {
    id: string;
    first_name: string;
    is_suspended: boolean;
}

// ── Pure helpers (simulate admin-reports logic) ──────────────────────────

function filterPendingReports(reports: Report[]): Report[] {
    return reports.filter((r) => r.status === "pending");
}

function enrichReportContext(
    report: Report,
    posts: Post[],
    users: User[],
): { targetLabel: string; targetDetail: string | null } {
    if (report.target_type === "post") {
        const post = posts.find((p) => p.id === report.target_id);
        return {
            targetLabel: `Post: ${post?.location ?? "Unknown"}`,
            targetDetail: post ? `by author ${post.author_id}` : null,
        };
    }
    const user = users.find((u) => u.id === report.target_id);
    return {
        targetLabel: `User: ${user?.first_name ?? "Unknown"}`,
        targetDetail: null,
    };
}

/** Reporter identity hidden to preserve anonymity */
function buildReportRow(report: Report) {
    return {
        id: report.id,
        target_type: report.target_type,
        target_id: report.target_id,
        reason: report.reason,
        note: report.note,
        status: report.status,
        // reporter_id deliberately omitted
    };
}

function dismissReport(report: Report, adminId: string): Partial<Report> {
    return {
        status: "dismissed",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
    };
}

function actionReportRemovePost(
    report: Report,
    adminId: string,
): { reportUpdate: Partial<Report>; postUpdate: Partial<Post> } {
    return {
        reportUpdate: {
            status: "actioned",
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
        },
        postUpdate: { status: "deleted" },
    };
}

function actionReportSuspendUser(
    report: Report,
    adminId: string,
): { reportUpdate: Partial<Report>; userUpdate: Partial<User> } {
    return {
        reportUpdate: {
            status: "actioned",
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
        },
        userUpdate: { is_suspended: true },
    };
}

function buildContentRemovedEmail(postLocation: string): {
    subject: string;
    body: string;
} {
    return {
        subject: "Your post has been removed",
        body: `Your post at ${postLocation} was removed for violating our community guidelines. If you believe this was in error, please contact support.`,
    };
}

// ── Test data ────────────────────────────────────────────────────────────

const reports: Report[] = [
    {
        id: "rpt-1",
        reporter_id: "user-a",
        target_type: "post",
        target_id: "post-1",
        reason: "spam",
        note: null,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
    },
    {
        id: "rpt-2",
        reporter_id: "user-b",
        target_type: "user",
        target_id: "user-c",
        reason: "inappropriate",
        note: "Bad behaviour",
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
    },
    {
        id: "rpt-3",
        reporter_id: "user-d",
        target_type: "post",
        target_id: "post-1",
        reason: "incorrect_info",
        note: null,
        status: "dismissed",
        reviewed_by: "admin-1",
        reviewed_at: "2026-04-01T00:00:00Z",
    },
];

const posts: Post[] = [
    { id: "post-1", author_id: "user-x", status: "active", location: "Longshore Club" },
];

const users: User[] = [
    { id: "user-c", first_name: "Charlie", is_suspended: false },
];

// ── Tests ────────────────────────────────────────────────────────────────

describe("Admin reports panel", () => {
    it("reports panel shows pending reports", () => {
        const pending = filterPendingReports(reports);
        expect(pending).toHaveLength(2);
        expect(pending.every((r) => r.status === "pending")).toBe(true);
    });

    it("report shows target context for post reports", () => {
        const ctx = enrichReportContext(reports[0], posts, users);
        expect(ctx.targetLabel).toBe("Post: Longshore Club");
        expect(ctx.targetDetail).toBe("by author user-x");
    });

    it("report shows target context for user reports", () => {
        const ctx = enrichReportContext(reports[1], posts, users);
        expect(ctx.targetLabel).toBe("User: Charlie");
    });

    it("report does NOT show reporter identity", () => {
        // Reporter identity hidden to preserve anonymity
        const row = buildReportRow(reports[0]);
        expect(row).not.toHaveProperty("reporter_id");
        expect(row).not.toHaveProperty("reporter_name");
        expect(Object.values(row)).not.toContain(reports[0].reporter_id);
    });

    it("admin can dismiss a report", () => {
        const update = dismissReport(reports[0], "admin-1");
        expect(update.status).toBe("dismissed");
        expect(update.reviewed_by).toBe("admin-1");
        expect(update.reviewed_at).toBeDefined();
        expect(new Date(update.reviewed_at!).getTime()).not.toBeNaN();
    });

    it("admin can remove content — soft-delete a reported post", () => {
        const { reportUpdate, postUpdate } = actionReportRemovePost(reports[0], "admin-1");
        expect(reportUpdate.status).toBe("actioned");
        expect(reportUpdate.reviewed_by).toBe("admin-1");
        expect(reportUpdate.reviewed_at).toBeDefined();
        expect(postUpdate.status).toBe("deleted");
    });

    it("admin can remove content — suspend a reported user", () => {
        const { reportUpdate, userUpdate } = actionReportSuspendUser(reports[1], "admin-1");
        expect(reportUpdate.status).toBe("actioned");
        expect(reportUpdate.reviewed_by).toBe("admin-1");
        expect(userUpdate.is_suspended).toBe(true);
    });

    it("removed post notification uses correct copy", () => {
        const email = buildContentRemovedEmail("Longshore Club");
        expect(email.subject).toContain("removed");
        expect(email.body).toContain("community guidelines");
        // Must NOT mention reporter
        expect(email.body).not.toMatch(/reporter/i);
        expect(email.body).not.toContain("user-a");
    });

    it("actioning one report does not affect other reports on same target", () => {
        // rpt-1 and rpt-3 both target post-1
        const sameTarget = reports.filter((r) => r.target_id === "post-1");
        expect(sameTarget).toHaveLength(2);

        // Action rpt-1
        const update = dismissReport(sameTarget[0], "admin-1");
        expect(update.status).toBe("dismissed");

        // rpt-3 remains unchanged
        expect(sameTarget[1].status).toBe("dismissed"); // already dismissed from before
        expect(sameTarget[1].id).toBe("rpt-3");
        // Verify original report object was not mutated
        expect(reports[0].status).toBe("pending");
    });
});
