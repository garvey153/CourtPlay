import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Metrics {
    totalUsers: number | null;
    activeUsers: number | null;
    posts: number | null;
    matches: number | null;
    pushOptIn: number | null;
    pendingClaims: number | null;
    customCourts: number | null;
    pendingReports: number | null;
}

interface FunnelStep {
    label: string;
    count: number;
    pctOfPrevious: number | null;
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-lg bg-secondary p-4">
            <p className="text-lg font-semibold text-brand-500">{value}</p>
            <p className="text-xs text-tertiary">{label}</p>
        </div>
    );
}

export function AdminAnalytics() {
    const [metrics, setMetrics] = useState<Metrics>({
        totalUsers: null,
        activeUsers: null,
        posts: null,
        matches: null,
        pushOptIn: null,
        pendingClaims: null,
        customCourts: null,
        pendingReports: null,
    });
    const [funnel, setFunnel] = useState<FunnelStep[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAll() {
            setLoading(true);
            try {
                await Promise.all([fetchMetrics(), fetchFunnel()]);
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
            pushUsersRes,
            pendingClaimsRes,
            customCourtsRes,
            pendingReportsRes,
            activePostAuthorsRes,
            activeClaimersRes,
        ] = await Promise.all([
            supabase.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null),
            supabase.from("posts").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
            supabase.from("claims").select("id", { count: "exact", head: true }).eq("status", "approved").gte("created_at", sevenDaysAgo),
            supabase.from("users").select("id", { count: "exact", head: true }).not("onesignal_player_id", "is", null).is("deleted_at", null),
            supabase.from("claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
            supabase.from("custom_court_submissions").select("id", { count: "exact", head: true }),
            supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
            supabase.from("posts").select("author_id").gte("created_at", sevenDaysAgo),
            supabase.from("claims").select("claimer_id").gte("created_at", sevenDaysAgo),
        ]);

        // Active users (7d) = distinct post authors + claimers.
        const activeUserIds = new Set<string>();
        for (const row of activePostAuthorsRes.data ?? []) if (row.author_id) activeUserIds.add(row.author_id);
        for (const row of activeClaimersRes.data ?? []) if (row.claimer_id) activeUserIds.add(row.claimer_id);

        setMetrics({
            totalUsers: totalUsersRes.count ?? 0,
            activeUsers: activeUserIds.size,
            posts: recentPostsRes.count ?? 0,
            matches: recentMatchesRes.count ?? 0,
            pushOptIn: pushUsersRes.count ?? 0,
            pendingClaims: pendingClaimsRes.count ?? 0,
            customCourts: customCourtsRes.count ?? 0,
            pendingReports: pendingReportsRes.count ?? 0,
        });
    }

    async function fetchFunnel() {
        const [signupsRes, profileCompleteRes, firstFollowRes, firstPostOrClaimRes, firstMatchRes] = await Promise.all([
            supabase.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null),
            supabase.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null).not("full_name", "is", null),
            supabase.from("follows").select("follower_id"),
            Promise.all([supabase.from("posts").select("author_id"), supabase.from("claims").select("claimer_id")]),
            supabase.from("claims").select("claimer_id").eq("status", "approved"),
        ]);

        const signups = signupsRes.count ?? 0;
        const profileComplete = profileCompleteRes.count ?? 0;
        const firstFollow = new Set((firstFollowRes.data ?? []).map((r) => r.follower_id)).size;

        const [postsData, claimsData] = firstPostOrClaimRes;
        const postOrClaimUsers = new Set<string>();
        for (const row of postsData.data ?? []) if (row.author_id) postOrClaimUsers.add(row.author_id);
        for (const row of claimsData.data ?? []) if (row.claimer_id) postOrClaimUsers.add(row.claimer_id);
        const firstPostOrClaim = postOrClaimUsers.size;

        const firstMatch = new Set((firstMatchRes.data ?? []).map((r) => r.claimer_id)).size;

        const steps = [
            { label: "Sign-ups", count: signups },
            { label: "Profile complete", count: profileComplete },
            { label: "First follow", count: firstFollow },
            { label: "First post/claim", count: firstPostOrClaim },
            { label: "First match", count: firstMatch },
        ];

        setFunnel(
            steps.map((step, i) => ({
                ...step,
                pctOfPrevious: i === 0 || steps[i - 1].count === 0 ? null : Math.round((step.count / steps[i - 1].count) * 100),
            })),
        );
    }

    const fmt = (value: number | null): string => (value === null ? "—" : value.toLocaleString());

    const cards: { label: string; value: string }[] = [
        { label: "Total users", value: fmt(metrics.totalUsers) },
        { label: "Active users", value: fmt(metrics.activeUsers) },
        { label: "Posts", value: fmt(metrics.posts) },
        { label: "Matches", value: fmt(metrics.matches) },
        { label: "Push opt-in", value: fmt(metrics.pushOptIn) },
        { label: "Pending claims", value: fmt(metrics.pendingClaims) },
        { label: "Custom courts", value: fmt(metrics.customCourts) },
        { label: "Pending reports", value: fmt(metrics.pendingReports) },
    ];

    if (loading) {
        return <p className="py-8 text-center text-sm text-tertiary">Loading analytics…</p>;
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
                {cards.map((card) => (
                    <StatCard key={card.label} label={card.label} value={card.value} />
                ))}
            </div>

            {/* User funnel */}
            <div className="mt-2 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-tertiary">User funnel</h3>
                <div className="overflow-hidden rounded-lg border border-neutral-600 bg-secondary px-2">
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th className="px-2 py-3 text-left font-normal text-tertiary">Step</th>
                                <th className="px-2 py-3 text-right font-normal text-tertiary">Count</th>
                                <th className="px-2 py-3 text-right font-normal text-tertiary">% of Previous</th>
                            </tr>
                        </thead>
                        <tbody>
                            {funnel.map((step) => (
                                <tr key={step.label} className="border-t border-neutral-600">
                                    <td className="px-2 py-3 text-secondary">{step.label}</td>
                                    <td className="px-2 py-3 text-right text-secondary">{step.count.toLocaleString()}</td>
                                    <td className="px-2 py-3 text-right text-secondary">
                                        {step.pctOfPrevious !== null ? `${step.pctOfPrevious}%` : "--"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
