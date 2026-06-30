import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { GroupCard } from "@/components/app/group-card";
import { FeedFilters, activeCount } from "@/components/app/feed-filters";
import { PushPrompt } from "@/components/app/push-prompt";
import { SubCard } from "@/components/app/sub-card";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
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

function applyFilters(posts: FeedPost[], f: FilterState): FeedPost[] {
    return posts.filter((p) => {
        if (f.skillLevels.length > 0 && !f.skillLevels.includes(p.skill_level ?? "")) return false;
        // sub_need posts store their type in play_type; regular_game in format.
        if (f.formats.length > 0 && !f.formats.includes(p.play_type ?? p.format ?? "")) return false;
        if (f.dateFrom && p.game_date && p.game_date < f.dateFrom) return false;
        if (f.dateTo && p.game_date && p.game_date > f.dateTo) return false;
        if (f.courtId && p.court_id !== f.courtId) return false;
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
        courtId: null,
    });
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [detailPost, setDetailPost] = useState<FeedPost | null>(null);
    const [welcomeDismissed, setWelcomeDismissed] = useState(
        () => localStorage.getItem(WELCOME_KEY) === "1",
    );

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

    const filteredPosts = useMemo(() => applyFilters(posts, filters), [posts, filters]);
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

            <div className="flex flex-col gap-3 px-5 pb-4">
                {showWelcome && (
                    <WelcomeCard
                        onDismiss={handleDismissWelcome}
                        onPost={handleNavigateToPost}
                    />
                )}

                {/* Push prompt after first post creation */}
                {localStorage.getItem("courtsub_show_push_prompt") === "post_created" && (
                    <PushPrompt variant="post_created" />
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
                                    />
                                </li>
                            ),
                        )}
                    </ul>
                )}
            </div>

            {detailPost && (
                <ClaimDetailSheet
                    post={detailPost}
                    currentUserId={user?.id}
                    onClose={() => setDetailPost(null)}
                    onClaimed={() => {
                        setDetailPost(null);
                        fetchPosts();
                    }}
                />
            )}
        </AppLayout>
    );
}
