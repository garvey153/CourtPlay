import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterLines, SearchSm, XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { FeedFilters, activeCount } from "@/components/app/feed-filters";
import { formatPlayType } from "@/components/app/sub-card";
import type { FilterState } from "@/types/feed";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { AdminPostCard, type AdminPostRow } from "./admin-post-card";
import { AdminPostDetailSheet } from "./admin-post-detail-sheet";

// Admin shows every post regardless of status/author, so it loads a generous
// cap and filters client-side (matching the feed's filter UX) rather than paging.
const FETCH_LIMIT = 500;

interface Court {
    id: string;
    name: string;
}

interface PostRow {
    id: string;
    play_type: string | null;
    format: string | null;
    game_date: string | null;
    game_time: string | null;
    skill_level: string | null;
    duration: number | null;
    location: string | null;
    custom_court: string | null;
    court_id: string | null;
    cost: number | null;
    status: string;
    spots_total: number | null;
    notes: string | null;
    created_at: string;
    author_id: string;
    users: { first_name: string | null; photo_url: string | null } | null;
}

const EMPTY_FILTERS: FilterState = {
    skillLevels: [],
    formats: [],
    dateFrom: null,
    dateTo: null,
    courtIds: [],
};

function matchesFilters(post: AdminPostRow, f: FilterState): boolean {
    if (f.skillLevels.length > 0 && !f.skillLevels.includes(post.skill_level ?? "")) return false;
    // sub_need posts store their type in play_type; regular_game in format.
    if (f.formats.length > 0 && !f.formats.includes(post.play_type ?? post.format ?? "")) return false;
    if (f.dateFrom && post.game_date && post.game_date < f.dateFrom) return false;
    if (f.dateTo && post.game_date && post.game_date > f.dateTo) return false;
    if (f.courtIds.length > 0 && !f.courtIds.includes(post.court_id ?? "")) return false;
    return true;
}

function matchesSearch(post: AdminPostRow, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [post.location, post.custom_court, post.author_first_name, formatPlayType(post.play_type)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return haystack.includes(q);
}

export function AdminPosts() {
    const { user } = useAuth();

    const [posts, setPosts] = useState<AdminPostRow[]>([]);
    const [courts, setCourts] = useState<Court[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [detailPost, setDetailPost] = useState<AdminPostRow | null>(null);

    // Courts feed the shared filter sheet's location picker.
    useEffect(() => {
        supabase
            .from("courts")
            .select("id, name")
            .eq("active", true)
            .order("name")
            .then(({ data }) => setCourts(data ?? []));
    }, []);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError(null);

        const [postsRes, claimsRes] = await Promise.all([
            supabase
                .from("posts")
                .select(
                    "id, play_type, format, game_date, game_time, skill_level, duration, location, custom_court, court_id, cost, status, spots_total, notes, created_at, author_id, users:author_id(first_name, photo_url)",
                )
                .order("created_at", { ascending: false })
                .limit(FETCH_LIMIT),
            // Open (pending/approved) claims determine whether a post reads as "Claimed".
            supabase.from("claims").select("post_id").in("status", ["pending", "approved"]),
        ]);

        if (postsRes.error) {
            setError(postsRes.error.message);
            setPosts([]);
            setLoading(false);
            return;
        }

        const openClaimCounts = new Map<string, number>();
        for (const row of (claimsRes.data as { post_id: string }[]) ?? []) {
            openClaimCounts.set(row.post_id, (openClaimCounts.get(row.post_id) ?? 0) + 1);
        }

        const rows = ((postsRes.data as unknown as PostRow[]) ?? []).map<AdminPostRow>((p) => ({
            id: p.id,
            play_type: p.play_type,
            format: p.format,
            game_date: p.game_date,
            game_time: p.game_time,
            skill_level: p.skill_level,
            duration: p.duration,
            location: p.location,
            custom_court: p.custom_court,
            court_id: p.court_id,
            cost: p.cost,
            status: p.status,
            spots_available: (p.spots_total ?? 1) - (openClaimCounts.get(p.id) ?? 0),
            notes: p.notes,
            created_at: p.created_at,
            author_first_name: p.users?.first_name ?? "Unknown",
            author_photo_url: p.users?.photo_url ?? null,
        }));

        setPosts(rows);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const visiblePosts = useMemo(
        () => posts.filter((p) => matchesFilters(p, filters) && matchesSearch(p, search)),
        [posts, filters, search],
    );

    const handleSaved = () => {
        setDetailPost(null);
        fetchPosts();
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Search + filter row (design 347:5807) */}
            <div className="flex items-center gap-3">
                <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-neutral-700 px-3 shadow-xs">
                    <SearchSm className="size-6 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search posts"
                        className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearch("")}
                            className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-primary"
                        >
                            <XClose className="size-5" strokeWidth={1} />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-label="Filter posts"
                    className="relative shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <FilterLines className="size-6" aria-hidden="true" />
                    {activeCount(filters) > 0 && (
                        <span className="absolute right-1 top-[7px] size-1.5 rounded-full bg-brand-solid ring-2 ring-bg-primary" />
                    )}
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="size-6 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-sm text-error-primary">{error}</p>
                    <Button size="sm" color="primary" onClick={fetchPosts}>
                        Retry
                    </Button>
                </div>
            ) : visiblePosts.length === 0 ? (
                <p className="py-16 text-center text-sm text-tertiary">No posts match your filters.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {visiblePosts.map((post) => (
                        <AdminPostCard key={post.id} post={post} onOpen={setDetailPost} />
                    ))}
                </div>
            )}

            {/* Shared feed filter sheet */}
            <FeedFilters
                filters={filters}
                onChange={setFilters}
                courts={courts}
                isOpen={filtersOpen}
                onToggle={() => setFiltersOpen((v) => !v)}
            />

            {/* Moderation sheet */}
            {detailPost && user && (
                <AdminPostDetailSheet
                    post={detailPost}
                    currentUserId={user.id}
                    onClose={() => setDetailPost(null)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
