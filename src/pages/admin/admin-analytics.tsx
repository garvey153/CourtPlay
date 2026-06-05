import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Metrics {
    totalUsers: number | null;
    activeUsers7d: number | null;
    postsCreated7d: number | null;
    successfulMatches7d: number | null;
    pushOptInRate: number | null;
    pendingReports: number | null;
}

interface FunnelStep {
    label: string;
    count: number;
    pctOfPrevious: number | null;
}

interface RecentActivity {
    reportsThisWeek: number;
    pendingCourtPlaymissions: number;
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-secondary bg-primary p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-tertiary">{label}</p>
            <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
        </div>
    );
}

export function AdminAnalytics() {
    const [metrics, setMetrics] = useState<Metrics>({
        totalUsers: null,
        activeUsers7d: null,
        postsCreated7d: null,
        successfulMatches7d: null,
        pushOptInRate: null,
        pendingReports: null,
    });
    const [funnel, setFunnel] = useState<FunnelStep[]>([]);
    const [activity, setActivity] = useState<RecentActivity>({
        reportsThisWeek: 0,
        pendingCourtPlaymissions: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAll() {
            setLoading(true);
            try {
                await Promise.all([fetchMetrics(), fetchFunnel(), fetchRecentActivity()]);
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchAll();
    }, []);

    async function fetchMetrics() {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
            totalUsersRes,
            recentPostsRes,
            recentMatchesRes,
            pendingReportsRes,
            , // allUsersRes — redundant with totalUsersRes
            pushUsersRes,
            activePostAuthorsRes,
            activeClaimersRes,
        ] = await Promise.all([
            // Total users
            supabase
                .from("users")
                .select("id", { count: "exact", head: true })
                .is("deleted_at", null),
            // Posts created (7d)
            supabase
                .from("posts")
                .select("id", { count: "exact", head: true })
                .gte("created_at", sevenDaysAgo),
            // Successful matches (7d) — approved claims
            supabase
                .from("claims")
                .select("id", { count: "exact", head: true })
                .eq("status", "approved")
                .gte("created_at", sevenDaysAgo),
            // Pending reports
            supabase
                .from("reports")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending"),
            // All users for push opt-in rate denominator
            supabase
                .from("users")
                .select("id", { count: "exact", head: true })
                .is("deleted_at", null),
            // Users with push opt-in
            supabase
                .from("users")
                .select("id", { count: "exact", head: true })
                .not("onesignal_player_id", "is", null)
                .is("deleted_at", null),
            // Active post authors (7d)
            supabase
                .from("posts")
                .select("author_id")
                .gte("created_at", sevenDaysAgo),
            // Active claimers (7d)
            supabase
                .from("claims")
                .select("claimer_id")
                .gte("created_at", sevenDaysAgo),
        ]);

        // Calculate active users (distinct authors + claimers)
        const activeUserIds = new Set<string>();
        if (activePostAuthorsRes.data) {
            for (const row of activePostAuthorsRes.data) {
                if (row.author_id) activeUserIds.add(row.author_id);
            }
        }
        if (activeClaimersRes.data) {
            for (const row of activeClaimersRes.data) {
                if (row.claimer_id) activeUserIds.add(row.claimer_id);
            }
        }

        const totalUsersCount = totalUsersRes.count ?? 0;
        const pushUsersCount = pushUsersRes.count ?? 0;
        const pushRate = totalUsersCount > 0 ? (pushUsersCount / totalUsersCount) * 100 : 0;

        setMetrics({
            totalUsers: totalUsersRes.count ?? 0,
            activeUsers7d: activeUserIds.size,
            postsCreated7d: recentPostsRes.count ?? 0,
            successfulMatches7d: recentMatchesRes.count ?? 0,
            pushOptInRate: Math.round(pushRate),
            pendingReports: pendingReportsRes.count ?? 0,
        });
    }

    async function fetchFunnel() {
        const [
            signupsRes,
            profileCompleteRes,
            firstFollowRes,
            firstPostOrClaimRes,
            firstMatchRes,
        ] = await Promise.all([
            // Sign-ups: all non-deleted users
            supabase
                .from("users")
                .select("id", { count: "exact", head: true })
                .is("deleted_at", null),
            // Profile complete: users with full_name set
            supabase
                .from("users")
                .select("id", { count: "exact", head: true })
                .is("deleted_at", null)
                .not("full_name", "is", null),
            // First follow: users who have at least one follow
            supabase.from("follows").select("follower_id"),
            // First post or claim: distinct users
            Promise.all([
                supabase.from("posts").select("author_id"),
                supabase.from("claims").select("claimer_id"),
            ]),
            // First match: users with an approved claim (as poster or claimer)
            supabase.from("claims").select("claimer_id").eq("status", "approved"),
        ]);

        const signups = signupsRes.count ?? 0;
        const profileComplete = profileCompleteRes.count ?? 0;

        // Distinct followers
        const followerIds = new Set(
            (firstFollowRes.data ?? []).map((r) => r.follower_id),
        );
        const firstFollow = followerIds.size;

        // Distinct post/claim users
        const [postsData, claimsData] = firstPostOrClaimRes;
        const postOrClaimUsers = new Set<string>();
        for (const row of postsData.data ?? []) {
            if (row.author_id) postOrClaimUsers.add(row.author_id);
        }
        for (const row of claimsData.data ?? []) {
            if (row.claimer_id) postOrClaimUsers.add(row.claimer_id);
        }
        const firstPostOrClaim = postOrClaimUsers.size;

        // Distinct matched users
        const matchedUsers = new Set(
            (firstMatchRes.data ?? []).map((r) => r.claimer_id),
        );
        const firstMatch = matchedUsers.size;

        const steps = [
            { label: "Sign-ups", count: signups },
            { label: "Profile complete", count: profileComplete },
            { label: "First follow", count: firstFollow },
            { label: "First post / claim", count: firstPostOrClaim },
            { label: "First match", count: firstMatch },
        ];

        const funnelSteps: FunnelStep[] = steps.map((step, i) => ({
            ...step,
            pctOfPrevious:
                i === 0 || steps[i - 1].count === 0
                    ? null
                    : Math.round((step.count / steps[i - 1].count) * 100),
        }));

        setFunnel(funnelSteps);
    }

    async function fetchRecentActivity() {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [reportsRes, courtsRes] = await Promise.all([
            supabase
                .from("reports")
                .select("id", { count: "exact", head: true })
                .gte("created_at", sevenDaysAgo),
            supabase
                .from("custom_courts")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending"),
        ]);

        setActivity({
            reportsThisWeek: reportsRes.count ?? 0,
            pendingCourtPlaymissions: courtsRes.count ?? 0,
        });
    }

    function formatMetric(value: number | null): string {
        if (value === null) return "—";
        return value.toLocaleString();
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-primary">Analytics</h2>
                <p className="py-8 text-center text-sm text-tertiary">Loading analytics...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold text-primary">Analytics</h2>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard label="Total Users" value={formatMetric(metrics.totalUsers)} />
                <MetricCard label="Active Users (7d)" value={formatMetric(metrics.activeUsers7d)} />
                <MetricCard label="Posts (7d)" value={formatMetric(metrics.postsCreated7d)} />
                <MetricCard
                    label="Matches (7d)"
                    value={formatMetric(metrics.successfulMatches7d)}
                />
                <MetricCard
                    label="Push Opt-in"
                    value={
                        metrics.pushOptInRate !== null ? `${metrics.pushOptInRate}%` : "—"
                    }
                />
                <MetricCard
                    label="Pending Reports"
                    value={formatMetric(metrics.pendingReports)}
                />
            </div>

            {/* Funnel table */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-secondary">User Funnel</h3>
                <div className="overflow-hidden rounded-xl border border-secondary">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-secondary bg-secondary">
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-tertiary">
                                    Step
                                </th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-tertiary">
                                    Count
                                </th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-tertiary">
                                    % of Previous
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {funnel.map((step, i) => (
                                <tr
                                    key={step.label}
                                    className={
                                        i < funnel.length - 1
                                            ? "border-b border-secondary"
                                            : ""
                                    }
                                >
                                    <td className="px-4 py-2.5 text-primary">{step.label}</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-primary">
                                        {step.count.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-tertiary">
                                        {step.pctOfPrevious !== null
                                            ? `${step.pctOfPrevious}%`
                                            : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent activity */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-secondary">Recent Activity</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-secondary bg-primary p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                            Reports This Week
                        </p>
                        <p className="mt-1 text-2xl font-bold text-primary">
                            {activity.reportsThisWeek}
                        </p>
                    </div>
                    <div className="rounded-xl border border-secondary bg-primary p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                            Courts Pending Review
                        </p>
                        <p className="mt-1 text-2xl font-bold text-primary">
                            {activity.pendingCourtPlaymissions}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
