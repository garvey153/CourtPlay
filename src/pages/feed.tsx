import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { GroupCard } from "@/components/app/group-card";
import { FeedFilters, activeCount } from "@/components/app/feed-filters";
import { SubCard, gameEndMs } from "@/components/app/sub-card";
import { ClaimCancelledBanner } from "@/components/app/claim-cancelled-banner";
import { PostSuccessBanner } from "@/components/app/post-success-banner";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { GroupDetailSheet } from "@/components/app/group-detail-sheet";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { WelcomeCard } from "@/components/app/welcome-card";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";
import type { FeedPost, FilterState } from "@/types/feed";

const WELCOME_KEY = "cs_welcome_dismissed";
const VIEW_DEBOUNCE_MS = 300;

interface Court {
    id: string;
    name: string;
}

// Dated posts stay in the feed until 24h after their game date/time; after that
// they drop off. Undated posts (e.g. regular-game availability) are unaffected.
const FEED_GRACE_MS = 24 * 60 * 60 * 1000;
function withinFeedWindow(post: FeedPost): boolean {
    const end = gameEndMs(post);
    return end === null || Date.now() <= end + FEED_GRACE_MS;
}

function applyFilters(posts: FeedPost[], f: FilterState): FeedPost[] {
    return posts.filter((p) => {
        if (!withinFeedWindow(p)) return false;
        if (f.skillLevels.length > 0 && !f.skillLevels.includes(p.skill_level ?? "")) return false;
        // sub_need posts store their type in play_type; regular_game in format.
        if (f.formats.length > 0 && !f.formats.includes(p.play_type ?? p.format ?? "")) return false;
        if (f.dateFrom && p.game_date && p.game_date < f.dateFrom) return false;
        if (f.dateTo && p.game_date && p.game_date > f.dateTo) return false;
        if (f.courtIds.length > 0 && !f.courtIds.includes(p.court_id ?? "")) return false;
        return true;
    });
}

export function Feed() {
    const { user } = useAuth();
    const { profile } = useProfile();
    const navigate = useNavigate();

    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [courts, setCourts] = useState<Court[]>([]);
    const [filters, setFilters] = useState<FilterState>({
        skillLevels: [],
        formats: [],
        dateFrom: null,
        dateTo: null,
        courtIds: [],
    });
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [detailPost, setDetailPost] = useState<FeedPost | null>(null);
    // Set after a claim is cancelled — drives the "spot reopened" banner at the top of the feed.
    const [cancelledPost, setCancelledPost] = useState<FeedPost | null>(null);
    const [welcomeDismissed, setWelcomeDismissed] = useState(
        () => localStorage.getItem(WELCOME_KEY) === "1",
    );
    // Success banner shown once after a post is created (flag set by the post form).
    const [createdPost, setCreatedPost] = useState<{ id: string; type: "sub_need" | "regular_game" } | null>(() => {
        const raw = localStorage.getItem("courtsub_post_created");
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    });
    // Consume the flag so the banner only shows once.
    useEffect(() => {
        localStorage.removeItem("courtsub_post_created");
    }, []);

    // Tracks post IDs that have already had their view counted this session
    const viewedIds = useRef(new Set<string>());
    // Debounce timers per post ID
    const viewTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const fetchPosts = useCallback(async () => {
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("get_feed");
        if (rpcError) {
            setError("Failed to load the feed. Please try again.");
        } else if (data) {
            setPosts(data as FeedPost[]);
        }
        setLoading(false);
    }, []);

    // Initial load
    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Load courts for filter dropdown
    useEffect(() => {
        supabase
            .from("courts")
            .select("id, name")
            .eq("active", true)
            .order("name")
            .then(({ data }) => setCourts(data ?? []));
    }, []);

    // Real-time subscription — refetch on any posts change
    useEffect(() => {
        const channel = supabase
            .channel("feed-posts")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "posts" },
                () => { fetchPosts(); },
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchPosts]);

    // View tracking — called by each card when it enters the viewport
    const handleViewed = useCallback(
        (postId: string) => {
            if (!user || viewedIds.current.has(postId)) return;
            // Clear any existing timer for this post
            const existing = viewTimers.current.get(postId);
            if (existing) clearTimeout(existing);

            const t = setTimeout(async () => {
                if (viewedIds.current.has(postId)) return;
                viewedIds.current.add(postId);
                viewTimers.current.delete(postId);
                // Increment view count (fire-and-forget)
                supabase.rpc("increment_view_count", { p_post_id: postId }).then(() => {});
                // Record per-user view for price-drop notifications (Phase 8)
                supabase
                    .from("post_views")
                    .upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id" })
                    .then(() => {});
            }, VIEW_DEBOUNCE_MS);

            viewTimers.current.set(postId, t);
        },
        [user],
    );

    const handleDismissWelcome = useCallback(() => {
        localStorage.setItem(WELCOME_KEY, "1");
        setWelcomeDismissed(true);
    }, []);

    const handleNavigateToPost = useCallback(() => {
        navigate("/post/new");
    }, [navigate]);

    const handleToggleFilters = useCallback(() => {
        setFiltersOpen((v) => !v);
    }, []);

    const profileComplete =
        !!profile && !!(profile.skill_level) && !!(profile.headline || profile.photo_url);

    const filteredPosts = useMemo(() => {
        const visible = applyFilters(posts, filters);
        // Keep the RPC order, but sink posts whose game time has passed (expired /
        // past-claimed) to the bottom so they sit below still-upcoming spots.
        const isPast = (p: FeedPost) => {
            const end = gameEndMs(p);
            return end !== null && end < Date.now();
        };
        return visible
            .map((p, i) => ({ p, i }))
            .sort((a, b) => Number(isPast(a.p)) - Number(isPast(b.p)) || a.i - b.i)
            .map(({ p }) => p);
    }, [posts, filters]);
    const showWelcome = !welcomeDismissed && !loading && filteredPosts.length < 3;

    return (
        <AppLayout onOpenFilters={handleToggleFilters} filtersActive={activeCount(filters) > 0}>
            <FeedFilters
                filters={filters}
                onChange={setFilters}
                courts={courts}
                isOpen={filtersOpen}
                onToggle={handleToggleFilters}
            />

            <PullToRefresh onRefresh={fetchPosts}>
            <div className="flex flex-col gap-3 px-5 pb-4">
                {cancelledPost && (
                    <ClaimCancelledBanner
                        post={cancelledPost}
                        onDismiss={() => setCancelledPost(null)}
                        onUndo={() => {
                            // Reopen the sheet in the open (claimable) state so the user can claim again.
                            const fresh = posts.find((p) => p.id === cancelledPost.id);
                            setDetailPost(
                                fresh ?? {
                                    ...cancelledPost,
                                    user_claim_status: null,
                                    user_claim_id: null,
                                    spots_available: Math.max(1, cancelledPost.spots_available),
                                },
                            );
                            setCancelledPost(null);
                        }}
                    />
                )}

                {showWelcome && (
                    <WelcomeCard
                        onDismiss={handleDismissWelcome}
                        onPost={handleNavigateToPost}
                    />
                )}

                {/* Confirmation banner after a post is created */}
                {createdPost && (
                    <PostSuccessBanner
                        postType={createdPost.type}
                        onDismiss={() => setCreatedPost(null)}
                        onEdit={() => navigate(`/post/new?edit=${createdPost.id}`, { state: { returnTo: "/feed" } })}
                    />
                )}

                {loading ? (
                    <ul aria-label="Feed loading" className="flex flex-col gap-3">
                        {[1, 2, 3].map((i) => (
                            <li key={i} className="h-52 animate-pulse rounded-xl bg-secondary" />
                        ))}
                    </ul>
                ) : error ? (
                    <div className="flex flex-col items-center gap-4 py-16 text-center">
                        <p className="text-base font-semibold text-primary">Something went wrong</p>
                        <p className="text-sm text-tertiary">{error}</p>
                        <button
                            onClick={fetchPosts}
                            className="rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-16 text-center">
                        <p className="text-base font-semibold text-primary">No open spots right now</p>
                        <p className="text-sm text-tertiary">
                            Be the first to post one.
                        </p>
                        <button
                            onClick={handleNavigateToPost}
                            className="rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                        >
                            Find a Sub
                        </button>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {filteredPosts.map((post) =>
                            post.post_type === "sub_need" ? (
                                <li key={post.id}>
                                    <SubCard
                                        post={post}
                                        currentUserId={user?.id}
                                        onViewed={handleViewed}
                                        onOpenDetail={setDetailPost}
                                    />
                                </li>
                            ) : (
                                <li key={post.id}>
                                    <GroupCard
                                        post={post}
                                        profileComplete={profileComplete}
                                        currentUserId={user?.id}
                                        onViewed={handleViewed}
                                        onOpenDetail={setDetailPost}
                                    />
                                </li>
                            ),
                        )}
                    </ul>
                )}
            </div>
            </PullToRefresh>

            {detailPost &&
                (detailPost.post_type === "sub_need" ? (
                    <ClaimDetailSheet
                        post={detailPost}
                        currentUserId={user?.id}
                        onClose={() => setDetailPost(null)}
                        onClaimChange={fetchPosts}
                        onCancelled={(p) => {
                            setDetailPost(null);
                            setCancelledPost(p);
                            document.querySelector("main")?.scrollTo({ top: 0 });
                        }}
                    />
                ) : (
                    <GroupDetailSheet
                        post={detailPost}
                        currentUserId={user?.id}
                        onClose={() => setDetailPost(null)}
                        onConnected={() => {
                            setDetailPost(null);
                            fetchPosts();
                        }}
                    />
                ))}
        </AppLayout>
    );
}
