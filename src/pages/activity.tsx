import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { SubCard, gameEndMs, type CardKind } from "@/components/app/sub-card";
import { GroupCard } from "@/components/app/group-card";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { CreatedDetailSheet } from "@/components/app/created-detail-sheet";
import { PostDeletedBanner } from "@/components/app/post-deleted-banner";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { sendNotification, sendNotificationBatch } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { REJECTION_REASONS } from "@/types/claims";
import type { ClaimRow, MyClaim, MyPost } from "@/types/activity";
import type { FeedPost } from "@/types/feed";
import { claimToFeedPost, postToFeedPost } from "@/utils/activity-feed-map";
import { cx } from "@/utils/cx";

// ── Main component ─────────────────────────────────────────────────────────

type Tab = "claims" | "created";

export function Activity() {
    const { user } = useAuth();
    const { profile } = useProfile();
    const navigate = useNavigate();
    // Open a specific tab when navigated with ?tab= (e.g. returning from editing a created post).
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "created" ? "created" : "claims");
    const [myPosts, setMyPosts] = useState<MyPost[]>([]);
    const [myClaims, setMyClaims] = useState<MyClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Overlays
    // Claimer's detail sheet; contact is attached once the claim is approved.
    const [claimSheet, setClaimSheet] = useState<{ post: FeedPost; contact?: { venmoHandle: string | null; phone: string | null }; messages?: MyClaim["messages"] } | null>(null);
    const [createdSheet, setCreatedSheet] = useState<MyPost | null>(null); // creator view
    const [deletedPost, setDeletedPost] = useState<MyPost | null>(null); // undo banner
    const [deletingPost, setDeletingPost] = useState(false);
    const [undoingDelete, setUndoingDelete] = useState(false);

    const me =
        user && profile
            ? { id: user.id, first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }
            : null;

    const fetchData = useCallback(async () => {
        if (!user) return;
        setError(null);
        try {
            const [postsRes, claimsRes] = await Promise.all([
                supabase.rpc("get_my_posts_with_claims"),
                supabase.rpc("get_my_claims_with_posts"),
            ]);
            if (postsRes.error || claimsRes.error) {
                setError("Failed to load activity. Please try again.");
            } else {
                setMyPosts((postsRes.data as MyPost[]) ?? []);
                setMyClaims((claimsRes.data as MyClaim[]) ?? []);
            }
        } catch {
            setError("Failed to load activity. Please try again.");
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!actionError) return;
        const t = setTimeout(() => setActionError(null), 4000);
        return () => clearTimeout(t);
    }, [actionError]);

    // ── Actions (creator side; the claimer's cancel lives in ClaimDetailSheet) ──

    const handleApprove = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setActionLoading(claim.id);
            setActionError(null);
            try {
                const { data, error: rpcError } = await supabase.rpc("approve_claim", { p_claim_id: claim.id });
                if (rpcError || !data?.success) {
                    setActionError(data?.error ?? "Failed to approve claim.");
                    setActionLoading(null);
                    return;
                }
                sendNotification({
                    user_id: claim.claimer_id,
                    notification_type: "claim_approved",
                    post_id: post.id,
                    claim_id: claim.id,
                });
                // Refresh and keep the sheet open in its approved state so the thread
                // (including any reply the poster just sent) and contact stay visible.
                const { data: list } = await supabase.rpc("get_my_posts_with_claims");
                const posts = (list as MyPost[]) ?? [];
                setMyPosts(posts);
                setCreatedSheet(posts.find((p) => p.id === post.id) ?? null);
            } catch {
                setActionError("Something went wrong. Please try again.");
            }
            setActionLoading(null);
        },
        [],
    );

    const handleDecline = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setActionLoading(claim.id);
            setActionError(null);
            try {
                // Reason picker is deferred — decline with the default reason for now.
                const { data, error: rpcError } = await supabase.rpc("reject_claim", {
                    p_claim_id: claim.id,
                    p_reason: REJECTION_REASONS[0],
                });
                if (rpcError || !data?.success) {
                    setActionError(data?.error ?? "Failed to decline claim.");
                    setActionLoading(null);
                    return;
                }
                sendNotification({
                    user_id: claim.claimer_id,
                    notification_type: "claim_rejected",
                    post_id: post.id,
                    claim_id: claim.id,
                    data: { reason: REJECTION_REASONS[0] },
                });
                // Notify notify_me watchers that the spot reopened.
                const { data: watchers } = await supabase.from("notify_me").select("user_id").eq("post_id", post.id);
                const watcherIds = (watchers ?? []).map((w) => w.user_id).filter((id) => id !== user?.id);
                if (watcherIds.length > 0) sendNotificationBatch(watcherIds, "spot_reopened", post.id);
                fetchData();
            } catch {
                setActionError("Something went wrong. Please try again.");
            }
            setActionLoading(null);
        },
        [fetchData, user],
    );

    const handleCancelApproval = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setActionLoading(claim.id);
            setActionError(null);
            try {
                const { data, error: rpcError } = await supabase.rpc("cancel_approval", { p_claim_id: claim.id });
                if (rpcError || !data?.success) {
                    setActionError(data?.error ?? "Failed to cancel approval.");
                    setActionLoading(null);
                    return;
                }
                // Back to pending — refresh and keep the sheet open to re-decide.
                const { data: list } = await supabase.rpc("get_my_posts_with_claims");
                const posts = (list as MyPost[]) ?? [];
                setMyPosts(posts);
                setCreatedSheet(posts.find((p) => p.id === post.id) ?? null);
            } catch {
                setActionError("Something went wrong. Please try again.");
            }
            setActionLoading(null);
        },
        [],
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
            setDeletingPost(true);
            setActionError(null);
            const { error: delError } = await supabase
                .from("posts")
                .update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: user.id })
                .eq("id", post.id);
            setDeletingPost(false);
            if (delError) {
                setActionError("Failed to delete post. Please try again.");
                return;
            }
            setCreatedSheet(null);
            setDeletedPost(post); // drives the undo banner
            fetchData();
        },
        [fetchData, user],
    );

    const handleUndoDelete = useCallback(
        async (post: MyPost) => {
            if (!user) return;
            setUndoingDelete(true);
            const { error: undoError } = await supabase
                .from("posts")
                .update({ status: "active", deleted_at: null, deleted_by: null })
                .eq("id", post.id);
            setUndoingDelete(false);
            if (undoError) {
                setActionError("Failed to restore post. Please try again.");
                return;
            }
            setDeletedPost(null);
            fetchData();
        },
        [fetchData, user],
    );

    // ── Render ────────────────────────────────────────────────────────────────

    // Past the game's date/time (time optional → treat as end of day).
    // gameEndMs handles the Postgres "HH:MM:SS" format and returns null on parse failure.
    const isPast = (date: string | null, time: string | null) => {
        const end = gameEndMs({ game_date: date, game_time: time });
        return end !== null && end < Date.now();
    };

    const renderClaims = () => {
        // Three sections only: Pending (awaiting approval), Approved, Declined.
        // Backed-out/cancelled claims are hidden; approved + declined drop once the
        // event time has passed. Pending stays until resolved.
        const allSections: Array<{
            label: string;
            kind: CardKind;
            claims: MyClaim[];
            onTap?: (claim: MyClaim) => void;
        }> = [
            {
                label: "Pending",
                kind: "pending",
                claims: myClaims.filter((c) => c.status === "pending"),
                onTap: (claim) => setClaimSheet({ post: claimToFeedPost(claim), messages: claim.messages }),
            },
            {
                label: "Approved",
                kind: "approved",
                claims: myClaims.filter((c) => c.status === "approved" && !isPast(c.game_date, c.game_time)),
                onTap: (claim) =>
                    setClaimSheet({
                        post: claimToFeedPost(claim),
                        contact: { venmoHandle: claim.poster_venmo_handle, phone: claim.poster_phone },
                        messages: claim.messages,
                    }),
            },
            {
                label: "Declined",
                kind: "rejected",
                claims: myClaims.filter((c) => c.status === "rejected" && !isPast(c.game_date, c.game_time)),
            },
        ];
        const sections = allSections.filter((s) => s.claims.length > 0);

        if (sections.length === 0) {
            return (
                <EmptyState
                    title="No claims yet"
                    body="You haven't claimed any spots yet."
                    ctaLabel="Browse the feed"
                    ctaHref="/feed"
                />
            );
        }

        return (
            <div className="flex flex-col gap-5">
                {sections.map((section) => (
                    <div key={section.label}>
                        <p className="mb-2 text-xs font-medium text-tertiary">{section.label}</p>
                        <ul className="flex flex-col gap-3">
                            {section.claims.map((claim) => (
                                <li key={claim.id}>
                                    <SubCard
                                        post={claimToFeedPost(claim)}
                                        currentUserId={user?.id}
                                        kindOverride={section.kind}
                                        onOpenDetail={section.onTap ? () => section.onTap!(claim) : undefined}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        );
    };

    const renderCreated = () => {
        // Drop deleted posts, and expired posts once the event is more than 7 days past
        // (undated posts stay). gameEndMs returns null for undated posts / parse failures.
        const graceCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const visiblePosts = myPosts.filter((post) => {
            if (post.status === "deleted") return false;
            const end = gameEndMs(post);
            return end === null || end >= graceCutoff;
        });

        const hasPending = (p: MyPost) => p.claims.some((c) => c.status === "pending");
        const hasApproved = (p: MyPost) => p.claims.some((c) => c.status === "approved");

        // Group into the same section style as the Claimed tab.
        const allSections: Array<{ label: string; kind: CardKind; posts: MyPost[] }> = [
            { label: "Pending", kind: "pending", posts: visiblePosts.filter((p) => hasPending(p)) },
            { label: "Approved", kind: "approved", posts: visiblePosts.filter((p) => !hasPending(p) && hasApproved(p)) },
            {
                label: "Active",
                kind: "open",
                posts: visiblePosts.filter((p) => !hasPending(p) && !hasApproved(p) && !isPast(p.game_date, p.game_time)),
            },
        ];
        const sections = allSections.filter((s) => s.posts.length > 0);

        const banner = deletedPost ? (
            <PostDeletedBanner
                onDismiss={() => setDeletedPost(null)}
                onUndo={() => handleUndoDelete(deletedPost)}
                undoing={undoingDelete}
            />
        ) : null;

        // Match the feed: regular-play posts use the blue GroupCard, subs the green SubCard.
        const renderCard = (post: MyPost, kind: CardKind) => {
            const feedPost = postToFeedPost(post, me ?? { id: "", first_name: "", last_name: "", photo_url: null });
            return post.post_type === "regular_game" ? (
                <GroupCard post={feedPost} profileComplete currentUserId={user?.id} onOpenDetail={() => setCreatedSheet(post)} />
            ) : (
                <SubCard post={feedPost} currentUserId={user?.id} kindOverride={kind} onOpenDetail={() => setCreatedSheet(post)} />
            );
        };

        if (sections.length === 0) {
            return (
                <div className="flex flex-1 flex-col">
                    {banner && <div className="mb-3">{banner}</div>}
                    <EmptyState
                        title="It's your serve!"
                        body="You haven't posted any openings yet."
                        ctaLabel="Find a sub"
                        ctaHref="/post/new"
                    />
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-5">
                {banner}
                {sections.map((section) => (
                    <div key={section.label}>
                        <p className="mb-2 text-xs font-medium text-tertiary">{section.label}</p>
                        <ul className="flex flex-col gap-3">
                            {section.posts.map((post) => (
                                <li key={post.id}>{renderCard(post, section.kind)}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <AppLayout>
            {/* Fill the body so empty states can center vertically. */}
            {/* Fill <main> exactly so it never scrolls/bounces — only the inner posts
                region below scrolls. This keeps the tabs fixed under the header, so a
                pull-to-refresh drags just the posts. */}
            <div className="flex h-full flex-col">
                {/* Pill tabs — fixed above the scrolling posts region.
                    pt-0.5 puts 24px between the logo baseline and the pill top. */}
                <div className="flex shrink-0 gap-2 bg-primary px-5 pt-0.5 pb-2">
                    {(
                        [
                            { id: "claims", label: "Claimed posts" },
                            { id: "created", label: "Created posts" },
                        ] as const
                    ).map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={cx(
                                "rounded-full px-3.5 py-1 text-xs font-semibold transition duration-100 ease-linear",
                                tab === t.id ? "bg-brand-500 text-neutral-950" : "bg-tertiary text-secondary hover:text-primary",
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {actionError && (
                    <div className="mx-5 mt-3 rounded-lg bg-error-secondary p-3 text-sm text-error-primary">{actionError}</div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                    <PullToRefresh onRefresh={fetchData} className="flex min-h-full flex-col" contentClassName="flex min-h-full flex-col">
                    <div className="flex flex-1 flex-col px-5 pt-2 pb-4">
                        {loading ? (
                            <ul aria-label="Loading" className="flex flex-col gap-3">
                                {[1, 2, 3].map((i) => (
                                    <li key={i} className="h-40 animate-pulse rounded-xl bg-secondary" />
                                ))}
                            </ul>
                        ) : error ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                                <p className="text-base font-semibold text-primary">Something went wrong</p>
                                <p className="text-sm text-tertiary">{error}</p>
                                <button
                                    onClick={fetchData}
                                    className="rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : tab === "claims" ? (
                            renderClaims()
                        ) : (
                            renderCreated()
                        )}
                    </div>
                    </PullToRefresh>
                </div>
            </div>


            {claimSheet && (
                <ClaimDetailSheet
                    post={claimSheet.post}
                    contact={claimSheet.contact}
                    messages={claimSheet.messages}
                    currentUser={
                        profile
                            ? { first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }
                            : undefined
                    }
                    currentUserId={user?.id}
                    onClose={() => setClaimSheet(null)}
                    onClaimChange={fetchData}
                />
            )}

            {createdSheet && me && (
                <CreatedDetailSheet
                    post={createdSheet}
                    poster={me}
                    actionLoading={actionLoading}
                    deleting={deletingPost}
                    onClose={() => setCreatedSheet(null)}
                    onApprove={(claim) => handleApprove(claim, createdSheet)}
                    onDecline={(claim) => {
                        const post = createdSheet;
                        setCreatedSheet(null);
                        handleDecline(claim, post);
                    }}
                    onCancelApproval={(claim) => handleCancelApproval(claim, createdSheet)}
                    onEdit={() => navigate(`/post/new?edit=${createdSheet.id}`, { state: { returnTo: "/activity?tab=created" } })}
                    onDelete={() => handleDeletePost(createdSheet)}
                    onReply={(body) => handleSendClaimMessage(createdSheet, body)}
                />
            )}
        </AppLayout>
    );
}

function EmptyState({ title, body, ctaLabel, ctaHref }: { title: string; body: string; ctaLabel: string; ctaHref: string }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-base font-semibold text-primary">{title}</p>
            <p className="text-sm text-tertiary">{body}</p>
            <Link
                to={ctaHref}
                className="mt-1 rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800"
            >
                {ctaLabel}
            </Link>
        </div>
    );
}
