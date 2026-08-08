import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterButton } from "@/components/app/filter-button";
import { SearchField } from "@/components/base/input/search-field";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { supabase } from "@/lib/supabase";
import { AdminClaimCard, claimerName, type AdminClaimRow } from "./admin-claim-card";
import { AdminClaimDetailSheet } from "./admin-claim-detail-sheet";
import { AdminClaimFilterSheet, EMPTY_CLAIM_FILTERS, claimFilterCount, type ClaimFilters } from "./admin-claim-filter-sheet";
import { LoadingState } from "@/components/application/loading-indicator/spinner";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";

const FETCH_LIMIT = 500;

interface ClaimQueryRow {
    id: string;
    status: string;
    created_at: string;
    claimer_id: string;
    post_id: string;
    users: { first_name: string | null; last_name: string | null; email: string | null; photo_url: string | null } | null;
    posts: {
        location: string | null;
        custom_court: string | null;
        game_date: string | null;
        game_time: string | null;
        play_type: string | null;
        format: string | null;
        skill_level: string | null;
        duration: number | null;
        cost: number | null;
        author_id: string | null;
    } | null;
}

function matchesFilters(claim: AdminClaimRow, f: ClaimFilters): boolean {
    return f.status === "all" || claim.status === f.status;
}

function matchesSearch(claim: AdminClaimRow, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [claimerName(claim), claim.claimer_email, claim.location, claim.custom_court]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
}

export function AdminClaims() {
    const [claims, setClaims] = useState<AdminClaimRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<ClaimFilters>(EMPTY_CLAIM_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [detailClaim, setDetailClaim] = useState<AdminClaimRow | null>(null);

    const fetchClaims = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        setError(null);

        const claimsRes = await supabase
            .from("claims")
            .select(
                `id, status, created_at, claimer_id, post_id,
                 users!claimer_id(first_name, last_name, email, photo_url),
                 posts!post_id(location, custom_court, game_date, game_time, play_type, format, skill_level, duration, cost, author_id)`,
            )
            .order("created_at", { ascending: false })
            .limit(FETCH_LIMIT);

        if (claimsRes.error) {
            (console.error("admin load failed:", claimsRes.error), setError(claimsRes.error));
            setClaims([]);
            setLoading(false);
            return;
        }

        const rows = (claimsRes.data as unknown as ClaimQueryRow[]) ?? [];

        // Poster responsiveness (avg seconds to respond) for the posters in this set.
        const posterIds = [...new Set(rows.map((c) => c.posts?.author_id).filter(Boolean) as string[])];
        const responseMap = new Map<string, number>();
        if (posterIds.length > 0) {
            const { data: resp } = await supabase
                .from("responsiveness_log")
                .select("poster_id, avg_response_seconds")
                .in("poster_id", posterIds);
            for (const r of (resp as { poster_id: string; avg_response_seconds: number }[]) ?? []) {
                responseMap.set(r.poster_id, r.avg_response_seconds);
            }
        }

        setClaims(
            rows.map<AdminClaimRow>((c) => ({
                id: c.id,
                status: c.status,
                created_at: c.created_at,
                claimer_id: c.claimer_id,
                post_id: c.post_id,
                post_author_id: c.posts?.author_id ?? null,
                play_type: c.posts?.play_type ?? null,
                format: c.posts?.format ?? null,
                game_date: c.posts?.game_date ?? null,
                game_time: c.posts?.game_time ?? null,
                skill_level: c.posts?.skill_level ?? null,
                duration: c.posts?.duration ?? null,
                location: c.posts?.location ?? null,
                custom_court: c.posts?.custom_court ?? null,
                cost: c.posts?.cost ?? null,
                claimer_first_name: c.users?.first_name ?? null,
                claimer_last_name: c.users?.last_name ?? null,
                claimer_email: c.users?.email ?? null,
                claimer_photo_url: c.users?.photo_url ?? null,
                poster_avg_response_seconds: c.posts?.author_id ? (responseMap.get(c.posts.author_id) ?? null) : null,
            })),
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchClaims();
    }, [fetchClaims]);

    const visibleClaims = useMemo(
        () => claims.filter((c) => matchesFilters(c, filters) && matchesSearch(c, search)),
        [claims, filters, search],
    );

    const handleSaved = () => {
        setDetailClaim(null);
        fetchClaims();
    };

    return (
        <>
        <PullToRefresh
            onRefresh={() => fetchClaims({ silent: true })}
            className="flex flex-1 flex-col gap-4"
            contentClassName="flex flex-1 flex-col"
            header={
                <>
            {/* Search + filter row (design 348:4863) */}
            <div className="flex items-center gap-3">
                <SearchField
                        className="flex-1"
                        variant="outline"
                        value={search}
                        onChange={setSearch}
                        placeholder="Search claims"
                    />
                <FilterButton
                    onClick={() => setFiltersOpen((v) => !v)}
                    isActive={claimFilterCount(filters) > 0}
                    label="Filter claims"
                />
            </div>
                </>
            }
        >
            {loading ? (
                <LoadingState variant="grow" />
            ) : error ? (
                <ErrorState variant="grow" error={error} subject="claims" onRetry={() => fetchClaims()} />
            ) : visibleClaims.length === 0 ? (
                search || claimFilterCount(filters) > 0 ? (
                    <EmptyState
                        variant="grow"
                        title="No claims match"
                        description="Nothing's getting past those filters. Try loosening them up."
                        actionLabel="Clear filters"
                        onAction={() => {
                            setSearch("");
                            setFilters(EMPTY_CLAIM_FILTERS);
                        }}
                    />
                ) : (
                    <EmptyState variant="grow" title="No claims yet" description="Nobody has claimed a spot so far." />
                )
            ) : (
                <div className="flex flex-col gap-3">
                    {visibleClaims.map((claim) => (
                        <AdminClaimCard key={claim.id} claim={claim} onOpen={setDetailClaim} />
                    ))}
                </div>
            )}

        </PullToRefresh>

            <AdminClaimFilterSheet
                filters={filters}
                onChange={setFilters}
                isOpen={filtersOpen}
                onToggle={() => setFiltersOpen((v) => !v)}
            />

            {detailClaim && (
                <AdminClaimDetailSheet claim={detailClaim} onClose={() => setDetailClaim(null)} onSaved={handleSaved} />
            )}
        </>
    );
}
