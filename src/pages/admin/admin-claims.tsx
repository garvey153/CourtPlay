import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Input } from "@/components/base/input/input";
import { SearchLg } from "@untitledui/icons";

const PAGE_SIZE = 20;

type ClaimStatus = "pending" | "approved" | "rejected" | "unclaimed" | "cancelled";

const STATUS_OPTIONS: Array<{ value: ClaimStatus | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "unclaimed", label: "Unclaimed" },
    { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE_COLOR: Record<ClaimStatus, "gray" | "brand" | "success" | "error" | "warning"> = {
    pending: "warning",
    approved: "success",
    rejected: "error",
    unclaimed: "gray",
    cancelled: "gray",
};

interface ClaimRow {
    id: string;
    status: ClaimStatus;
    created_at: string;
    claimer_id: string;
    post_id: string;
    users: { first_name: string; last_name: string; email: string } | null;
    posts: {
        location: string;
        custom_court: string | null;
        game_date: string;
        game_time: string;
        author_id: string;
    } | null;
}

interface ResponsivenessData {
    poster_id: string;
    avg_response_seconds: number;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatResponseTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

export function AdminClaims() {
    const [claims, setClaims] = useState<ClaimRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState<ClaimStatus | "all">("all");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [responsivenessMap, setResponsivenessMap] = useState<Record<string, number>>({});

    const fetchClaims = useCallback(async () => {
        setLoading(true);
        const offset = page * PAGE_SIZE;

        let query = supabase
            .from("claims")
            .select(
                `
                id, status, created_at, claimer_id, post_id,
                users!claimer_id(first_name, last_name, email),
                posts!post_id(location, custom_court, game_date, game_time, author_id)
            `,
                { count: "exact" },
            )
            .order("created_at", { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

        if (statusFilter !== "all") {
            query = query.eq("status", statusFilter);
        }

        const { data, count, error } = await query;

        if (error) {
            console.error("Failed to fetch claims:", error);
            setLoading(false);
            return;
        }

        const rows = (data ?? []) as unknown as ClaimRow[];
        setClaims(rows);
        setTotalCount(count ?? 0);

        // Fetch responsiveness data for all poster IDs in this page
        const posterIds = [
            ...new Set(rows.map((c) => c.posts?.author_id).filter(Boolean) as string[]),
        ];
        if (posterIds.length > 0) {
            const { data: respData } = await supabase
                .from("responsiveness_log")
                .select("poster_id, avg_response_seconds")
                .in("poster_id", posterIds);

            if (respData) {
                const map: Record<string, number> = {};
                for (const row of respData as ResponsivenessData[]) {
                    map[row.poster_id] = row.avg_response_seconds;
                }
                setResponsivenessMap(map);
            }
        }

        setLoading(false);
    }, [page, statusFilter]);

    useEffect(() => {
        fetchClaims();
    }, [fetchClaims]);

    // Reset to page 0 when filters change
    useEffect(() => {
        setPage(0);
    }, [statusFilter, search]);

    const handleCancelClaim = async (claim: ClaimRow) => {
        setCancellingId(claim.id);
        try {
            const { error } = await supabase
                .from("claims")
                .update({ status: "cancelled" })
                .eq("id", claim.id);

            if (error) {
                console.error("Failed to cancel claim:", error);
                return;
            }

            // Notify claimer
            await sendNotification({
                user_id: claim.claimer_id,
                notification_type: "claimer_cancelled",
                post_id: claim.post_id,
                claim_id: claim.id,
            });

            // Notify poster
            if (claim.posts?.author_id) {
                await sendNotification({
                    user_id: claim.posts.author_id,
                    notification_type: "claimer_cancelled",
                    post_id: claim.post_id,
                    claim_id: claim.id,
                });
            }

            await fetchClaims();
        } finally {
            setCancellingId(null);
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // Client-side text search filtering
    const filteredClaims = search.trim()
        ? claims.filter((c) => {
              const term = search.toLowerCase();
              const claimerName = `${c.users?.first_name ?? ""} ${c.users?.last_name ?? ""}`.toLowerCase();
              const email = (c.users?.email ?? "").toLowerCase();
              const location = (c.posts?.location ?? "").toLowerCase();
              const customCourt = (c.posts?.custom_court ?? "").toLowerCase();
              return (
                  claimerName.includes(term) ||
                  email.includes(term) ||
                  location.includes(term) ||
                  customCourt.includes(term)
              );
          })
        : claims;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-primary">Claims Management</h2>

            {/* Filter bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <Input
                        label="Search"
                        placeholder="Search by name, email, or location..."
                        icon={SearchLg}
                        value={search}
                        onChange={(e) => setSearch(e.toString())}
                        size="sm"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-secondary">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "all")}
                        className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary shadow-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-tertiary">
                {totalCount} claim{totalCount !== 1 ? "s" : ""} found
            </p>

            {/* Claims list — mobile card layout */}
            {loading ? (
                <div className="py-12 text-center text-tertiary">Loading claims...</div>
            ) : filteredClaims.length === 0 ? (
                <div className="py-12 text-center text-tertiary">No claims found.</div>
            ) : (
                <div className="space-y-3">
                    {filteredClaims.map((claim) => {
                        const claimerName = claim.users
                            ? `${claim.users.first_name} ${claim.users.last_name}`
                            : "Unknown";
                        const courtDisplay =
                            claim.posts?.custom_court ?? claim.posts?.location ?? "Unknown";
                        const gameDate = claim.posts?.game_date
                            ? formatDate(claim.posts.game_date)
                            : "N/A";
                        const gameTime = claim.posts?.game_time ?? "";
                        const posterId = claim.posts?.author_id;
                        const avgResponse =
                            posterId && responsivenessMap[posterId] != null
                                ? responsivenessMap[posterId]
                                : null;

                        return (
                            <div
                                key={claim.id}
                                className="rounded-xl border border-secondary bg-primary p-4 shadow-xs"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-primary">
                                            {claimerName}
                                        </p>
                                        <p className="mt-0.5 text-sm text-secondary">
                                            {claim.users?.email}
                                        </p>
                                    </div>
                                    <Badge
                                        size="sm"
                                        color={STATUS_BADGE_COLOR[claim.status]}
                                    >
                                        {claim.status}
                                    </Badge>
                                </div>

                                <div className="mt-3 space-y-1 text-sm text-tertiary">
                                    <p>
                                        <span className="font-medium text-secondary">Court:</span>{" "}
                                        {courtDisplay}
                                    </p>
                                    <p>
                                        <span className="font-medium text-secondary">Game:</span>{" "}
                                        {gameDate} {gameTime}
                                    </p>
                                    <p>
                                        <span className="font-medium text-secondary">Claimed:</span>{" "}
                                        {formatDate(claim.created_at)}
                                    </p>
                                    {avgResponse != null && (
                                        <p>
                                            <span className="font-medium text-secondary">
                                                Poster Avg Response:
                                            </span>{" "}
                                            {formatResponseTime(avgResponse)}
                                        </p>
                                    )}
                                </div>

                                {claim.status !== "cancelled" && (
                                    <div className="mt-3 flex justify-end">
                                        <Button
                                            size="sm"
                                            color="primary-destructive"
                                            isLoading={cancellingId === claim.id}
                                            isDisabled={cancellingId != null}
                                            onClick={() => handleCancelClaim(claim)}
                                        >
                                            Cancel Claim
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <Button
                        size="sm"
                        color="secondary"
                        isDisabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-tertiary">
                        Page {page + 1} of {totalPages}
                    </span>
                    <Button
                        size="sm"
                        color="secondary"
                        isDisabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
