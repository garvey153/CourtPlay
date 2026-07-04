import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { SubCard, type CardKind } from "@/components/app/sub-card";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { CreatedDetailSheet } from "@/components/app/created-detail-sheet";
import { ContactModal, type ContactInfo } from "@/components/app/contact-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { sendNotification, sendNotificationBatch } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { REJECTION_REASONS } from "@/types/claims";
import type { ClaimRow, MyClaim, MyPost } from "@/types/activity";
import type { FeedPost } from "@/types/feed";
import { derivePostState } from "@/utils/activity-states";
import { claimToFeedPost, postKind, postToFeedPost } from "@/utils/activity-feed-map";
import { cx } from "@/utils/cx";

// ── Main component ─────────────────────────────────────────────────────────

type Tab = "claims" | "created";

export function Activity() {
    const { user } = useAuth();
    const { profile } = useProfile();
    const [tab, setTab] = useState<Tab>("claims");
    const [myPosts, setMyPosts] = useState<MyPost[]>([]);
    const [myClaims, setMyClaims] = useState<MyClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Overlays
    const [contactModal, setContactModal] = useState<ContactInfo | null>(null);
    // Claimer's detail sheet; contact is attached once the claim is approved.
    const [claimSheet, setClaimSheet] = useState<{ post: FeedPost; contact?: { venmoHandle: string | null; phone: string | null } } | null>(null);
    const [createdSheet, setCreatedSheet] = useState<MyPost | null>(null); // creator view

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
                // Reveal claimer contact so the poster can coordinate + charge via Venmo.
                setContactModal({
                    role: "claimer",
                    viewerRole: "poster",
                    firstName: claim.first_name,
                    lastName: claim.last_name,
                    phone: claim.phone,
                    venmoHandle: claim.venmo_handle,
                    gameDate: post.game_date,
                    gameTime: post.game_time,
                    location: post.location ?? post.custom_court,
                    cost: post.cost,
                });
                fetchData();
            } catch {
                setActionError("Something went wrong. Please try again.");
            }
            setActionLoading(null);
        },
        [fetchData],
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

    const showClaimerContact = useCallback((claim: ClaimRow, post: MyPost) => {
        setContactModal({
            role: "claimer",
            viewerRole: "poster",
            firstName: claim.first_name,
            lastName: claim.last_name,
            phone: claim.phone,
            venmoHandle: claim.venmo_handle,
            gameDate: post.game_date,
            gameTime: post.game_time,
            location: post.location ?? post.custom_court,
            cost: post.cost,
        });
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────

    // Past the game's date/time (time optional → treat as end of day).
    const isPast = (date: string | null, time: string | null) =>
        !!date && new Date(`${date}T${time ?? "23:59"}:00`).getTime() < Date.now();

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
                onTap: (claim) => setClaimSheet({ post: claimToFeedPost(claim) }),
            },
            {
                label: "Approved",
                kind: "approved",
                claims: myClaims.filter((c) => c.status === "approved" && !isPast(c.game_date, c.game_time)),
                onTap: (claim) =>
                    setClaimSheet({
                        post: claimToFeedPost(claim),
                        contact: { venmoHandle: claim.poster_venmo_handle, phone: claim.poster_phone },
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
        // Drop expired posts once the event is more than 7 days past (undated posts stay).
        const graceCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const visiblePosts = myPosts.filter((post) => {
            if (!post.game_date) return true;
            return new Date(`${post.game_date}T${post.game_time ?? "23:59"}:00`).getTime() >= graceCutoff;
        });
        if (visiblePosts.length === 0) {
            return (
                <EmptyState
                    title="No posts yet"
                    body="You haven't posted any sub needs yet."
                    ctaLabel="Find a Sub"
                    ctaHref="/post/new"
                />
            );
        }
        return (
            <ul className="flex flex-col gap-3">
                {visiblePosts.map((post) => (
                    <li key={post.id}>
                        <SubCard
                            post={me ? postToFeedPost(post, me) : postToFeedPost(post, { id: "", first_name: "", last_name: "", photo_url: null })}
                            currentUserId={user?.id}
                            kindOverride={postKind(derivePostState(post))}
                            onOpenDetail={() => setCreatedSheet(post)}
                        />
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <AppLayout>
            {/* Pill tabs */}
            <div className="flex gap-2 px-5 pt-3 pb-1">
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

            <div className="px-5 py-4">
                {loading ? (
                    <ul aria-label="Loading" className="flex flex-col gap-3">
                        {[1, 2, 3].map((i) => (
                            <li key={i} className="h-40 animate-pulse rounded-xl bg-secondary" />
                        ))}
                    </ul>
                ) : error ? (
                    <div className="flex flex-col items-center gap-4 py-16 text-center">
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

            {contactModal && <ContactModal info={contactModal} onClose={() => setContactModal(null)} />}

            {claimSheet && (
                <ClaimDetailSheet
                    post={claimSheet.post}
                    contact={claimSheet.contact}
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
                    onClose={() => setCreatedSheet(null)}
                    onApprove={(claim) => {
                        const post = createdSheet;
                        setCreatedSheet(null);
                        handleApprove(claim, post);
                    }}
                    onDecline={(claim) => {
                        const post = createdSheet;
                        setCreatedSheet(null);
                        handleDecline(claim, post);
                    }}
                    onViewContact={(claim) => {
                        const post = createdSheet;
                        setCreatedSheet(null);
                        showClaimerContact(claim, post);
                    }}
                />
            )}
        </AppLayout>
    );
}

function EmptyState({ title, body, ctaLabel, ctaHref }: { title: string; body: string; ctaLabel: string; ctaHref: string }) {
    return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-base font-semibold text-primary">{title}</p>
            <p className="text-sm text-tertiary">{body}</p>
            <Link
                to={ctaHref}
                className="mt-1 rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
            >
                {ctaLabel}
            </Link>
        </div>
    );
}
