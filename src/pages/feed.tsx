import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { RegularPlayCard } from "@/components/app/regular-play-card";
import { FeedFilters, activeCount } from "@/components/app/feed-filters";
import { SubCard, gameEndMs } from "@/components/app/sub-card";
import { ClaimCancelledBanner } from "@/components/app/claim-cancelled-banner";
import { PostSuccessBanner } from "@/components/app/post-success-banner";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { TaggedDetailSheet } from "@/components/app/tagged-detail-sheet";
import { RegularPlaySheet } from "@/components/app/regular-play-sheet";
import { CreatedDetailSheet } from "@/components/app/created-detail-sheet";
import { RegularConnectionsSheet } from "@/components/app/regular-connections-sheet";
import { ClaimReceivedBanner } from "@/components/app/claim-received-banner";
import { ClaimUpdateBanner } from "@/components/app/claim-update-banner";
import { PushEnableBanner } from "@/components/app/push-enable-banner";
import { GroupBanner } from "@/components/app/group-banner";
import { NotificationStack, type FeedNotification } from "@/components/app/notification-stack";
import { TaggedPostBanner } from "@/components/app/tagged-post-banner";
import { IosInstallPrompt } from "@/components/app/ios-install-prompt";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { WelcomeCard } from "@/components/app/welcome-card";
import { FeedbackBanner } from "@/components/app/feedback-banner";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { postAffectsViewer, useRealtimePosts, type PostChangeRow } from "@/hooks/use-realtime-posts";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import type { GroupSummary } from "@/types/groups";
import { REJECTION_REASONS } from "@/types/claims";
import { claimToFeedPost } from "@/utils/activity-feed-map";
import type { ClaimRow, MyClaim, MyPost } from "@/types/activity";
import type { FeedPost, FilterState, TaggedPost } from "@/types/feed";
import { applyFilters } from "@/utils/feed-filter";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";
import { LoadingState } from "@/components/application/loading-indicator/spinner";

const WELCOME_KEY = "cs_welcome_dismissed";

/**
 * First-run welcome card: shown to users who haven't posted yet, until they
 * dismiss it. Deliberately independent of the feed/filter count — an empty or
 * filtered feed is the "No open spots" state, not this card.
 *
 * `myPostsLoaded` is the part that isn't obvious. `feedLoading` only tracks
 * get_feed; the "mine" RPCs run separately and settle later, so between the two
 * an empty myPosts means "not fetched yet" and "you have no posts" at once.
 * Reading it as the latter is what made the card flash on every navigation to
 * the feed for users who do have posts. Extracted and exported so the invariant
 * is testable — rendering Feed itself needs the whole Supabase surface mocked.
 */
export function shouldShowWelcome(state: {
    dismissed: boolean;
    feedLoading: boolean;
    myPostsLoaded: boolean;
    myPostCount: number;
}): boolean {
    return !state.dismissed && !state.feedLoading && state.myPostsLoaded && state.myPostCount === 0;
}
const VIEW_DEBOUNCE_MS = 300;

interface Court {
    id: string;
    name: string;
}

export function Feed() {
    const { user } = useAuth();
    const { profile } = useProfile();
    const connectedOnly = !!profile?.feed_connected_only;
    const navigate = useNavigate();

    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
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
    // Tapping one of the viewer's own posts opens the creator sheet instead.
    const [createdSheet, setCreatedSheet] = useState<MyPost | null>(null);
    // The seeker's own regular-play post → conversation-list sheet.
    const [regularSheet, setRegularSheet] = useState<MyPost | null>(null);
    const [createdActionLoading, setCreatedActionLoading] = useState<string | null>(null);
    const [deletingCreated, setDeletingCreated] = useState(false);
    // Drives the claim banners: own posts (pending claims) + own claims (approved/declined).
    const [myPosts, setMyPosts] = useState<MyPost[]>([]);
    const [myClaims, setMyClaims] = useState<MyClaim[]>([]);
    // Dismissed banner keys, prefixed by type: "claimed:" | "approved:" | "declined:" + claimId.
    const [dismissedClaims, setDismissedClaims] = useState<Set<string>>(
        () => new Set<string>(JSON.parse(localStorage.getItem("cs_claim_banner_dismissed") || "[]")),
    );
    // Contact attached when opening a claim sheet for an approved claim.
    const [claimContact, setClaimContact] = useState<{ venmoHandle: string | null; phone: string | null } | null>(null);
    // Set after a claim is cancelled — drives the "spot reopened" banner at the top of the feed.
    const [cancelledPost, setCancelledPost] = useState<FeedPost | null>(null);
    const [welcomeDismissed, setWelcomeDismissed] = useState(
        () => localStorage.getItem(WELCOME_KEY) === "1",
    );
    // Whether the "mine" RPCs have come back yet. `loading` only covers get_feed,
    // so without this an empty myPosts means "not fetched yet" and "you have no
    // posts" at the same time — and the welcome card read it as the latter,
    // flashing on every navigation to the feed for users who do have posts.
    const [myPostsLoaded, setMyPostsLoaded] = useState(false);
    // Group changes surface here as banners. Derived from state rather than an
    // events table, which is why there is no "you were removed" banner — see
    // group-banner.tsx.
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    // Posts whose tagged group you're in — drives the two tagged banners.
    const [taggedPosts, setTaggedPosts] = useState<TaggedPost[]>([]);
    // Admin-only: ids of feedback submissions not yet dismissed from the feed banner.
    const [newFeedbackIds, setNewFeedbackIds] = useState<string[]>([]);
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

    // Post IDs the viewer authored or claimed — the only ones whose changes can
    // affect the banners, so the only ones worth re-running the "mine" RPCs for.
    // Refs, not state: the realtime change handler reads them at event time and
    // must not cause the channel to be re-opened when they change.
    const myPostIds = useRef<Set<string>>(new Set());
    const myClaimPostIds = useRef<Set<string>>(new Set());
    useEffect(() => {
        myPostIds.current = new Set(myPosts.map((p) => p.id));
    }, [myPosts]);
    useEffect(() => {
        myClaimPostIds.current = new Set(myClaims.map((c) => c.post_id));
    }, [myClaims]);

    // `silent` keeps the current list on screen for a pull-to-refresh. Without
    // it a retry cleared the error while loading was already false, so the empty
    // state flashed up mid-request.
    const fetchPosts = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        setError(null);
        let { data, error: rpcError } = await supabase.rpc("get_feed");

        // The first load straight out of onboarding can land while the session is
        // still settling, which fails the call once and then succeeds. get_feed is
        // security definer and read-only, so retrying it is safe.
        if (rpcError) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            ({ data, error: rpcError } = await supabase.rpc("get_feed"));
        }

        if (rpcError) {
            // Keep the underlying reason — the generic message alone made this
            // impossible to diagnose from a device.
            console.error("get_feed failed:", rpcError);
            setError(rpcError);
        } else if (data) {
            setPosts(data as FeedPost[]);
        }
        setLoading(false);
    }, []);

    const fetchGroups = useCallback(async () => {
        if (!user) return;
        const { data, error: rpcError } = await supabase.rpc("get_my_groups");
        if (rpcError) {
            console.error("get_my_groups failed:", rpcError);
            return;
        }
        setGroups(Array.isArray(data) ? (data as GroupSummary[]) : []);
    }, [user]);

    // Posts whose tagged group you're in, with the live claim's status — the
    // source for the two tagged banners. A separate RPC rather than reading
    // get_feed, because the banner has to appear for a post you may have
    // scrolled past, and it carries the claimer's name, which the feed row
    // deliberately doesn't.
    const fetchTaggedPosts = useCallback(async () => {
        if (!user) return;
        const { data, error: rpcError } = await supabase.rpc("get_my_tagged_posts");
        if (rpcError) {
            console.error("get_my_tagged_posts failed:", rpcError);
            return;
        }
        setTaggedPosts(Array.isArray(data) ? (data as TaggedPost[]) : []);
    }, [user]);

    const fetchMyPosts = useCallback(async () => {
        if (!user) return;
        const [postsRes, claimsRes] = await Promise.all([
            supabase.rpc("get_my_posts_with_claims"),
            supabase.rpc("get_my_claims_with_posts"),
        ]);
        setMyPosts((postsRes.data as MyPost[]) ?? []);
        setMyClaims((claimsRes.data as MyClaim[]) ?? []);
        setMyPostsLoaded(true);
    }, [user]);

    // Initial load
    useEffect(() => {
        fetchPosts();
        fetchMyPosts();
        fetchGroups();
        fetchTaggedPosts();
    }, [fetchPosts, fetchMyPosts, fetchGroups, fetchTaggedPosts]);

    // Admin-only: surface undismissed feedback as a top-of-feed banner. RLS lets
    // only admins read the feedback table, so this returns nothing for players.
    useEffect(() => {
        if (!profile?.is_admin) return;
        supabase
            .from("feedback")
            .select("id")
            .order("created_at", { ascending: false })
            .limit(50)
            .then(({ data }) => {
                const dismissed = new Set<string>(JSON.parse(localStorage.getItem("cs_feedback_banner_dismissed") || "[]"));
                setNewFeedbackIds(((data as { id: string }[]) ?? []).map((r) => r.id).filter((id) => !dismissed.has(id)));
            });
    }, [profile?.is_admin]);

    const dismissFeedbackBanner = useCallback(() => {
        const dismissed = new Set<string>(JSON.parse(localStorage.getItem("cs_feedback_banner_dismissed") || "[]"));
        newFeedbackIds.forEach((id) => dismissed.add(id));
        localStorage.setItem("cs_feedback_banner_dismissed", JSON.stringify([...dismissed]));
        setNewFeedbackIds([]);
    }, [newFeedbackIds]);

    // Load courts for filter dropdown
    useEffect(() => {
        supabase
            .from("courts")
            .select("id, name")
            .eq("active", true)
            .order("name")
            .then(({ data }) => setCourts(data ?? []));
    }, []);

    // The claim banners and the created/connections sheets only go stale when the
    // changed post is the viewer's own or one they claimed. For everybody else's
    // posts — nearly all of them — refetching the feed alone is correct, which
    // takes three RPCs per event down to one.
    const affectsViewer = useCallback(
        (row: PostChangeRow | null) =>
            postAffectsViewer(row, user?.id, myPostIds.current, myClaimPostIds.current),
        [user?.id],
    );

    const refetchFeedSilently = useCallback(() => fetchPosts({ silent: true }), [fetchPosts]);

    useRealtimePosts({
        refetchFeed: refetchFeedSilently,
        refetchMine: fetchMyPosts,
        affectsViewer,
    });

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

    // Own posts open the creator sheet (same as Activity → Created); others open the
    // claim/connect sheet. The creator sheet needs the post's claims, so fetch them.
    const openDetail = useCallback(
        async (post: FeedPost) => {
            if (!user || post.author_id !== user.id) {
                // Reveal the poster's contact for the pay CTA when the viewer's claim is approved.
                const mineClaim = myClaims.find((c) => c.post_id === post.id);
                setClaimContact(
                    mineClaim?.status === "approved"
                        ? { venmoHandle: mineClaim.poster_venmo_handle, phone: mineClaim.poster_phone }
                        : null,
                );
                setDetailPost(post);
                return;
            }
            const { data } = await supabase.rpc("get_my_posts_with_claims");
            const mine = ((data as MyPost[]) ?? []).find((p) => p.id === post.id);
            if (mine) {
                if (mine.post_type === "regular_game") setRegularSheet(mine);
                else setCreatedSheet(mine);
            } else setDetailPost(post);
        },
        [user, myClaims],
    );

    const handleRegularReply = useCallback(
        async (post: MyPost, claimId: string, body: string) => {
            await supabase.rpc("send_claim_message", { p_claim_id: claimId, p_body: body });
            const { data } = await supabase.rpc("get_my_posts_with_claims");
            const list = (data as MyPost[]) ?? [];
            setMyPosts(list);
            setRegularSheet(list.find((pp) => pp.id === post.id) ?? post);
        },
        [],
    );

    const handleApproveClaim = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setCreatedActionLoading(claim.id);
            const { data, error: rpcError } = await supabase.rpc("approve_claim", { p_claim_id: claim.id });
            if (!rpcError && data?.success) {
                sendNotification({ notification_type: "claim_approved", claim_id: claim.id });
                fetchPosts();
                // Refresh and keep the sheet open in its approved state (thread + contact).
                const { data: list } = await supabase.rpc("get_my_posts_with_claims");
                const posts = (list as MyPost[]) ?? [];
                setMyPosts(posts);
                setCreatedSheet(posts.find((p) => p.id === post.id) ?? null);
            }
            setCreatedActionLoading(null);
        },
        [fetchPosts, fetchMyPosts],
    );

    const handleDeclineClaim = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setCreatedActionLoading(claim.id);
            const { data, error: rpcError } = await supabase.rpc("reject_claim", { p_claim_id: claim.id, p_reason: REJECTION_REASONS[0] });
            if (!rpcError && data?.success) {
                sendNotification({ notification_type: "claim_rejected", claim_id: claim.id });
                // Declining frees the spot: spots_available counts pending and
                // approved claims alike, so a rejected pending claim reopens one.
                sendNotification({ notification_type: "spot_reopened", post_id: post.id });
                setCreatedSheet(null);
                fetchPosts();
                fetchMyPosts();
            }
            setCreatedActionLoading(null);
        },
        [fetchPosts, fetchMyPosts],
    );

    const handleCancelApproval = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setCreatedActionLoading(claim.id);
            const { data, error: rpcError } = await supabase.rpc("cancel_approval", { p_claim_id: claim.id });
            if (!rpcError && data?.success) {
                // Tell the claimer: cancel_approval sets the claim back to
                // pending, so their spot isn't gone, it's undecided again.
                sendNotification({ notification_type: "approval_cancelled", claim_id: claim.id });
                fetchPosts();
                const { data: list } = await supabase.rpc("get_my_posts_with_claims");
                const posts = (list as MyPost[]) ?? [];
                setMyPosts(posts);
                setCreatedSheet(posts.find((p) => p.id === post.id) ?? null);
            }
            setCreatedActionLoading(null);
        },
        [fetchPosts],
    );

    const handleSendClaimMessage = useCallback(
        async (post: MyPost, body: string) => {
            const c = post.claims.find((x) => x.status === "pending" || x.status === "approved");
            if (!c) return;
            await supabase.rpc("send_claim_message", { p_claim_id: c.id, p_body: body });
            const { data } = await supabase.rpc("get_my_posts_with_claims");
            const list = (data as MyPost[]) ?? [];
            setMyPosts(list);
            setCreatedSheet(list.find((pp) => pp.id === post.id) ?? post);
        },
        [],
    );

    const handleDeletePost = useCallback(
        async (post: MyPost) => {
            if (!user) return;
            setDeletingCreated(true);
            const { error: delError } = await supabase
                .from("posts")
                .update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: user.id })
                .eq("id", post.id);
            setDeletingCreated(false);
            if (!delError) {
                // A seeker removing their regular post found a spot — tell the responders.
                if (post.post_type === "regular_game" && post.claims.length > 0) {
                    sendNotification({ notification_type: "connection_closed", post_id: post.id });
                }
                setCreatedSheet(null);
                setRegularSheet(null);
                fetchPosts();
                fetchMyPosts();
            }
        },
        [fetchPosts, fetchMyPosts, user, profile],
    );

    const dismissBanner = useCallback((key: string) => {
        setDismissedClaims((prev) => {
            const next = new Set(prev);
            next.add(key);
            localStorage.setItem("cs_claim_banner_dismissed", JSON.stringify([...next]));
            return next;
        });
    }, []);

    const claimPast = (c: MyClaim) => {
        const end = gameEndMs({ game_date: c.game_date, game_time: c.game_time });
        return end !== null && end < Date.now();
    };

    // Creator side: own posts with a pending claim (awaiting the viewer's approval).
    const pendingBanners = myPosts
        // Regular-play connections notify via push, not the "your spot was claimed" banner.
        .filter((post) => post.post_type !== "regular_game")
        .map((post) => ({ post, claim: post.claims.find((c) => c.status === "pending") }))
        .filter((x): x is { post: MyPost; claim: ClaimRow } => !!x.claim && !dismissedClaims.has(`claimed:${x.claim.id}`));
    // Claimer side: the viewer's claims that were approved / declined (upcoming games).
    const approvedBanners = myClaims.filter(
        (c) => c.status === "approved" && !claimPast(c) && !dismissedClaims.has(`approved:${c.id}`),
    );
    // A week is long enough that someone who opens the app occasionally still
    // sees it, short enough that it stops being news.
    const BANNER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const fresh = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < BANNER_WINDOW_MS;

    // get_my_groups also returns recent removals so this banner is possible, so
    // every other derivation here has to exclude them explicitly.
    const addedGroups = groups.filter(
        // Not your own group: you already know, you made it.
        (g) =>
            !g.my_removed_at &&
            !g.is_creator &&
            !g.is_closed &&
            fresh(g.joined_at) &&
            !dismissedClaims.has(`group_added:${g.id}`),
    );
    const closedGroups = groups.filter(
        (g) => !g.my_removed_at && g.is_closed && fresh(g.closed_at) && !dismissedClaims.has(`group_closed:${g.id}`),
    );
    const removedGroups = groups.filter(
        // Not removed_by_me: leaving is not news to the person who did it, and
        // removed_at alone cannot tell the two apart.
        (g) => !g.removed_by_me && fresh(g.my_removed_at) && !dismissedClaims.has(`group_removed:${g.id}`),
    );

    // The tagged banners. `fresh` bounds them the same way the group ones are
    // bounded — a claim from three weeks ago is not news — and the claim's
    // status picks which of the two notices to show.
    const taggedClaimed = taggedPosts.filter(
        (p) => p.claim_status === "pending" && !dismissedClaims.has(`tagged_claimed:${p.claim_id}`),
    );
    const taggedApproved = taggedPosts.filter(
        (p) => p.claim_status === "approved" && !dismissedClaims.has(`tagged_approved:${p.claim_id}`),
    );

    const declinedBanners = myClaims.filter(
        (c) => c.status === "rejected" && !claimPast(c) && !dismissedClaims.has(`declined:${c.id}`),
    );

    const profileComplete =
        !!profile && !!(profile.skill_level) && !!(profile.headline || profile.photo_url);

    const filteredPosts = useMemo(() => {
        const visible = applyFilters(posts, filters, connectedOnly);
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
    }, [posts, filters, connectedOnly]);
    // First-run welcome: shown once to users who haven't posted yet (until they
    // dismiss it). Deliberately independent of the feed/filter count — an empty or
    // filtered feed is handled by the "No open spots" state below, not this card.
    /**
     * Feed notifications, highest priority FIRST — the feed shows the top one and
     * stacks the rest behind it (see NotificationStack).
     *
     * The order is the one these banners already rendered in, kept deliberately:
     * something needing a decision (a claim on your post) outranks something that
     * merely happened (a group closed), and a confirmation of what you just did
     * outranks nothing at all.
     *
     * Push and install prompts, and the welcome card, are NOT in here. They are
     * standing invitations rather than events, so burying them under a claim
     * would mean they are never seen.
     */
    const notifications: FeedNotification[] = [];
    if (profile?.is_admin && newFeedbackIds.length > 0) {
        notifications.push({
            key: "feedback",
            node: (
                <FeedbackBanner
                    count={newFeedbackIds.length}
                    onView={() => {
                        dismissFeedbackBanner();
                        navigate("/admin?tab=reports&section=feedback");
                    }}
                    onDismiss={dismissFeedbackBanner}
                />
            ),
        });
    }
    pendingBanners.forEach(({ post, claim }) =>
        notifications.push({
            key: `claimed:${claim.id}`,
            node: (
                <ClaimReceivedBanner
                    post={post}
                    onDismiss={() => dismissBanner(`claimed:${claim.id}`)}
                    onView={() => setCreatedSheet(post)}
                />
            ),
        }),
    );

    approvedBanners.forEach((claim) =>
        notifications.push({
            key: `approved:${claim.id}`,
            node: (
                <ClaimUpdateBanner
                    claim={claim}
                    status="approved"
                    onDismiss={() => dismissBanner(`approved:${claim.id}`)}
                    onView={() => {
                        setDetailPost(claimToFeedPost(claim));
                        setClaimContact({ venmoHandle: claim.poster_venmo_handle, phone: claim.poster_phone });
                    }}
                />
            ),
        }),
    );
    declinedBanners.forEach((claim) =>
        notifications.push({
            key: `declined:${claim.id}`,
            node: <ClaimUpdateBanner claim={claim} status="rejected" onDismiss={() => dismissBanner(`declined:${claim.id}`)} />,
        }),
    );
    ([
        ["added", addedGroups],
        ["removed", removedGroups],
        ["closed", closedGroups],
    ] as const).forEach(([kind, groups]) =>
        groups.forEach((g) =>
            notifications.push({
                key: `group_${kind}:${g.id}`,
                node: (
                    <GroupBanner
                        group={g}
                        kind={kind}
                        onDismiss={() => dismissBanner(`group_${kind}:${g.id}`)}
                        onView={() => navigate("/profile/me")}
                    />
                ),
            }),
        ),
    );
    ([
        ["approved", taggedApproved],
        ["claimed", taggedClaimed],
    ] as const).forEach(([kind, posts]) =>
        posts.forEach((p) =>
            notifications.push({
                key: `tagged_${kind}:${p.claim_id}`,
                node: (
                    <TaggedPostBanner
                        post={p}
                        kind={kind}
                        onDismiss={() => dismissBanner(`tagged_${kind}:${p.claim_id}`)}
                        onView={() => navigate(`/post/${p.id}`)}
                    />
                ),
            }),
        ),
    );
    if (cancelledPost) {
        notifications.push({
            key: `cancelled:${cancelledPost.id}`,
            node: (
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
            ),
        });
    }
    if (createdPost) {
        notifications.push({
            key: `created:${createdPost.id}`,
            node: (
                <PostSuccessBanner
                    postType={createdPost.type}
                    onDismiss={() => setCreatedPost(null)}
                    onEdit={() => navigate(`/post/new?edit=${createdPost.id}`, { state: { returnTo: "/feed" } })}
                />
            ),
        });
    }

    const showWelcome = shouldShowWelcome({
        dismissed: welcomeDismissed,
        feedLoading: loading,
        myPostsLoaded,
        myPostCount: myPosts.length,
    });

    return (
        <AppLayout onOpenFilters={handleToggleFilters} filtersActive={activeCount(filters) > 0}>
            <FeedFilters
                filters={filters}
                onChange={setFilters}
                courts={courts}
                isOpen={filtersOpen}
                onToggle={handleToggleFilters}
            />

            <PullToRefresh
                onRefresh={() => Promise.all([fetchPosts({ silent: true }), fetchMyPosts()])}
                className="flex min-h-full flex-col"
                contentClassName="flex min-h-full flex-1 flex-col"
            >
            <div className="flex flex-1 flex-col gap-3 px-5 pb-4">
                <NotificationStack items={notifications} />

                {/* Prompt to enable push if not granted (banner pattern). */}
                <PushEnableBanner />

                {/* Install prompt — first feed item so it scrolls/pulls like a post. */}
                <IosInstallPrompt />

                {showWelcome && (
                    <WelcomeCard
                        onDismiss={handleDismissWelcome}
                        onPost={handleNavigateToPost}
                    />
                )}

                {loading ? (
                    <LoadingState variant="grow" label="Loading the feed" />
                ) : error ? (
                    <ErrorState variant="grow" error={error} subject="the feed" onRetry={() => fetchPosts()} />
                ) : filteredPosts.length === 0 ? (
                    <EmptyState
                        variant="grow"
                        title="The courts are quiet"
                        description="No open spots right now — be the first to put one up."
                        actionLabel="Find a sub"
                        onAction={handleNavigateToPost}
                    />
                ) : (
                    <ul className="flex flex-col gap-3">
                        {filteredPosts.map((post) =>
                            post.post_type === "sub_need" ? (
                                <li key={post.id}>
                                    <SubCard
                                        post={post}
                                        currentUserId={user?.id}
                                        onViewed={handleViewed}
                                        onOpenDetail={openDetail}
                                    />
                                </li>
                            ) : (
                                <li key={post.id}>
                                    <RegularPlayCard
                                        post={post}
                                        profileComplete={profileComplete}
                                        currentUserId={user?.id}
                                        onViewed={handleViewed}
                                        onOpenDetail={openDetail}
                                    />
                                </li>
                            ),
                        )}
                    </ul>
                )}
            </div>
            </PullToRefresh>

            {detailPost &&
                (detailPost.post_type === "sub_need" && detailPost.is_tagged ? (
                    // You're in the group playing this game: context and a share
                    // action, no claim. Checked before the claim sheet so the
                    // tagged experience wins for someone who is also in the
                    // post's audience.
                    <TaggedDetailSheet
                        post={detailPost}
                        groupName={detailPost.tagged_group_name}
                        onClose={() => setDetailPost(null)}
                    />
                ) : detailPost.post_type === "sub_need" ? (
                    <ClaimDetailSheet
                        post={detailPost}
                        contact={claimContact ?? undefined}
                        messages={myClaims.find((c) => c.post_id === detailPost.id)?.messages}
                        currentUser={
                            profile
                                ? { first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }
                                : undefined
                        }
                        currentUserId={user?.id}
                        onClose={() => {
                            setDetailPost(null);
                            setClaimContact(null);
                        }}
                        onClaimChange={() => {
                            fetchPosts();
                            fetchMyPosts();
                        }}
                        onCancelled={(p) => {
                            setDetailPost(null);
                            setClaimContact(null);
                            setCancelledPost(p);
                            document.querySelector("main")?.scrollTo({ top: 0 });
                        }}
                    />
                ) : (
                    <RegularPlaySheet
                        post={detailPost}
                        currentUserId={user?.id}
                        messages={myClaims.find((c) => c.post_id === detailPost.id)?.messages}
                        currentUser={
                            profile
                                ? { first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }
                                : undefined
                        }
                        onClose={() => setDetailPost(null)}
                        onChange={() => {
                            fetchPosts();
                            fetchMyPosts();
                        }}
                    />
                ))}

            {createdSheet && profile && (
                <CreatedDetailSheet
                    post={createdSheet}
                    poster={{ first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }}
                    actionLoading={createdActionLoading}
                    deleting={deletingCreated}
                    onClose={() => setCreatedSheet(null)}
                    onApprove={(claim) => handleApproveClaim(claim, createdSheet)}
                    onDecline={(claim) => handleDeclineClaim(claim, createdSheet)}
                    onCancelApproval={(claim) => handleCancelApproval(claim, createdSheet)}
                    onEdit={() => navigate(`/post/new?edit=${createdSheet.id}`, { state: { returnTo: "/feed" } })}
                    onDelete={() => handleDeletePost(createdSheet)}
                    onReply={(body) => handleSendClaimMessage(createdSheet, body)}
                />
            )}

            {regularSheet && profile && (
                <RegularConnectionsSheet
                    post={regularSheet}
                    poster={{ first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }}
                    deleting={deletingCreated}
                    onClose={() => setRegularSheet(null)}
                    onEdit={() => navigate(`/post/new?edit=${regularSheet.id}`, { state: { returnTo: "/feed" } })}
                    onDelete={() => handleDeletePost(regularSheet)}
                    onReply={(claimId, body) => handleRegularReply(regularSheet, claimId, body)}
                />
            )}
        </AppLayout>
    );
}
