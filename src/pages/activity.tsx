import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ContactModal, type ContactInfo } from "@/components/app/contact-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { sendNotification, sendNotificationBatch } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import type { ClaimStatus, RejectionReason } from "@/types/claims";
import { REJECTION_REASONS } from "@/types/claims";
import { derivePostState, POST_STATE_BADGE, isReopenedClaim } from "@/utils/activity-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface ClaimRow {
    id: string;
    status: ClaimStatus;
    created_at: string;
    claimer_id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    skill_level: string | null;
    venmo_handle: string | null;
    phone: string | null;
}

interface MyPost {
    id: string;
    post_type: string;
    format: string | null;
    play_type: string | null;
    duration: number | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    custom_court: string | null;
    cost: number | null;
    original_cost: number | null;
    spots_total: number;
    spots_available: number;
    status: string;
    created_at: string;
    series_id: string | null;
    deleted_at: string | null;
    deleted_by: string | null;
    claims: ClaimRow[];
}

interface MyClaim {
    id: string;
    status: ClaimStatus;
    created_at: string;
    rejection_reason: RejectionReason | null;
    post_id: string;
    post_type: string;
    post_status: string;
    format: string | null;
    play_type: string | null;
    duration: number | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    custom_court: string | null;
    cost: number | null;
    poster_id: string;
    poster_first_name: string;
    poster_last_name: string;
    poster_photo_url: string | null;
    poster_venmo_handle: string | null;
    poster_phone: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

// sub_need posts store their type in `play_type`; regular_game posts use
// `format`. Prefer play_type, fall back to format, then a generic label.
function postLabel(playType: string | null, format: string | null): string {
    const labels: Record<string, string> = {
        doubles: "Doubles",
        point_play: "Point play",
        clinic: "Clinic",
        lesson: "Lesson",
        round_robin: "Round robin",
        other: "Other",
    };
    const value = playType ?? format;
    return value ? (labels[value] ?? value) : "Sub needed";
}

function formatDuration(duration: number | null): string | null {
    if (duration == null) return null;
    return duration === 1 ? "1 hr" : `${duration} hrs`;
}

function claimStatusBadge(status: ClaimStatus) {
    switch (status) {
        case "pending":   return <Badge color="warning" size="sm" type="pill-color">Pending</Badge>;
        case "approved":  return <Badge color="success" size="sm" type="pill-color">Approved</Badge>;
        case "rejected":  return <Badge color="error" size="sm" type="pill-color">Rejected</Badge>;
        case "unclaimed": return <Badge color="gray" size="sm" type="pill-color">Backed out</Badge>;
        case "cancelled": return <Badge color="gray" size="sm" type="pill-color">Cancelled</Badge>;
    }
}

// ── Main component ─────────────────────────────────────────────────────────

type Tab = "posts" | "claims";

export function Activity() {
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>("posts");
    const [myPosts, setMyPosts] = useState<MyPost[]>([]);
    const [myClaims, setMyClaims] = useState<MyClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [contactModal, setContactModal] = useState<ContactInfo | null>(null);

    // Rejection flow state
    const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null);
    const [selectedReason, setSelectedReason] = useState<RejectionReason>(REJECTION_REASONS[0]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Unclaim confirmation
    const [unclaimingId, setUnclaimingId] = useState<string | null>(null);

    // Reopen confirmation
    const [reopeningClaimId, setReopeningClaimId] = useState<string | null>(null);

    // Discount flow
    const [discountingPostId, setDiscountingPostId] = useState<string | null>(null);
    const [newPrice, setNewPrice] = useState("");

    // Cancel post flow
    const [cancellingPostId, setCancellingPostId] = useState<string | null>(null);

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

    // Auto-dismiss action error
    useEffect(() => {
        if (!actionError) return;
        const t = setTimeout(() => setActionError(null), 4000);
        return () => clearTimeout(t);
    }, [actionError]);

    // ── Actions ──────────────────────────────────────────────────────────────

    const handleApprove = useCallback(async (claimId: string, claim: ClaimRow, post: MyPost) => {
        setActionLoading(claimId);
        setActionError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc("approve_claim", { p_claim_id: claimId });

            if (rpcError || !data?.success) {
                setActionError(data?.error ?? "Failed to approve claim.");
                setActionLoading(null);
                return;
            }

            // Notify claimer of approval
            sendNotification({
                user_id: claim.claimer_id,
                notification_type: "claim_approved",
                post_id: post.id,
                claim_id: claimId,
            });

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
    }, [fetchData]);

    const handleReject = useCallback(async (claimId: string, claimerId?: string, postId?: string) => {
        setActionLoading(claimId);
        setActionError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc("reject_claim", {
                p_claim_id: claimId,
                p_reason: selectedReason,
            });

            if (rpcError || !data?.success) {
                setActionError(data?.error ?? "Failed to reject claim.");
                setActionLoading(null);
                return;
            }

            // Notify claimer of rejection
            if (claimerId) {
                sendNotification({
                    user_id: claimerId,
                    notification_type: "claim_rejected",
                    post_id: postId,
                    claim_id: claimId,
                    data: { reason: selectedReason },
                });
            }

            // N9: Notify notify_me watchers when spot reopens via rejection
            if (postId) {
                const { data: watchers } = await supabase
                    .from("notify_me")
                    .select("user_id")
                    .eq("post_id", postId);
                if (watchers && watchers.length > 0) {
                    const watcherIds = watchers.map((w) => w.user_id);
                    if (watcherIds.length > 0) {
                        sendNotificationBatch(watcherIds, "spot_reopened", postId);
                    }
                }
            }

            setRejectingClaimId(null);
            fetchData();
        } catch {
            setActionError("Something went wrong. Please try again.");
        }
        setActionLoading(null);
    }, [selectedReason, fetchData]);

    const handleUnclaim = useCallback(async (claimId: string, posterId?: string, postId?: string, claimStatus?: string) => {
        setActionLoading(claimId);
        setActionError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc("unclaim", { p_claim_id: claimId });

            if (rpcError || !data?.success) {
                setActionError(data?.error ?? "Failed to back out of claim.");
                setActionLoading(null);
                return;
            }

            // N4 vs N7: distinguish approved (backed out) from pending (cancelled)
            if (posterId) {
                const notificationType = claimStatus === "approved" ? "claimer_backed_out" : "claimer_cancelled";
                sendNotification({
                    user_id: posterId,
                    notification_type: notificationType,
                    post_id: postId,
                    claim_id: claimId,
                });
            }

            // N9: Notify notify_me watchers when spot reopens
            if (postId) {
                const { data: watchers } = await supabase
                    .from("notify_me")
                    .select("user_id")
                    .eq("post_id", postId);
                if (watchers && watchers.length > 0) {
                    const watcherIds = watchers.map((w) => w.user_id).filter((id) => id !== user?.id);
                    if (watcherIds.length > 0) {
                        sendNotificationBatch(watcherIds, "spot_reopened", postId);
                    }
                }
            }

            setUnclaimingId(null);
            fetchData();
        } catch {
            setActionError("Something went wrong. Please try again.");
        }
        setActionLoading(null);
    }, [fetchData, user]);

    const handleReopen = useCallback(async (claimId: string, claimerId?: string, postId?: string) => {
        setActionLoading(claimId);
        setActionError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc("reopen_claim", { p_claim_id: claimId });

            if (rpcError || !data?.success) {
                setActionError(data?.error ?? "Failed to reopen spot.");
                setActionLoading(null);
                return;
            }

            // Notify claimer that their spot was reopened
            if (claimerId) {
                sendNotification({
                    user_id: claimerId,
                    notification_type: "spot_reopened",
                    post_id: postId,
                    claim_id: claimId,
                });
            }
            // Notify notify_me watchers — handled server-side via Edge Function trigger

            setReopeningClaimId(null);
            fetchData();
        } catch {
            setActionError("Something went wrong. Please try again.");
        }
        setActionLoading(null);
    }, [fetchData]);

    const handleViewClaimDetails = useCallback((claim: MyClaim) => {
        setContactModal({
            role: "poster",
            viewerRole: "claimer",
            firstName: claim.poster_first_name,
            lastName: claim.poster_last_name,
            phone: claim.poster_phone,
            venmoHandle: claim.poster_venmo_handle,
            gameDate: claim.game_date,
            gameTime: claim.game_time,
            location: claim.location ?? claim.custom_court,
            cost: claim.cost,
        });
    }, []);

    const handleShowApprovedContact = useCallback((claim: ClaimRow, post: MyPost) => {
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

    const handleStartReject = useCallback((claimId: string) => {
        setRejectingClaimId(claimId);
        setSelectedReason(REJECTION_REASONS[0]);
    }, []);

    const handleCloseContactModal = useCallback(() => {
        setContactModal(null);
    }, []);

    const handleReducePrice = useCallback(async (postId: string, currentCost: number, originalCost: number | null) => {
        const parsed = parseFloat(newPrice);
        if (isNaN(parsed) || parsed < 0 || parsed >= currentCost) {
            setActionError("New price must be lower than the current price.");
            return;
        }

        setActionLoading(postId);
        setActionError(null);

        try {
            // Atomic update — preserve original_cost if already set (second+ discount)
            await supabase.from("posts").update({
                cost: parsed,
                original_cost: originalCost ?? currentCost,
            }).eq("id", postId);

            // N5: Notify active claimers of cost change
            const { data: activeClaims } = await supabase
                .from("claims")
                .select("claimer_id")
                .eq("post_id", postId)
                .in("status", ["pending", "approved"]);

            const activeClaimerIds = new Set(
                (activeClaims ?? []).map((c) => c.claimer_id),
            );

            if (activeClaimerIds.size > 0) {
                sendNotificationBatch([...activeClaimerIds], "cost_changed", postId, {
                    old_cost: currentCost.toFixed(2),
                    new_cost: parsed.toFixed(2),
                });
            }

            // N8: Notify prior viewers of price drop — exclude poster and active claimers
            if (user) {
                const { data: viewers } = await supabase
                    .from("post_views")
                    .select("user_id")
                    .eq("post_id", postId)
                    .neq("user_id", user.id);

                if (viewers && viewers.length > 0) {
                    const viewerIds = viewers
                        .map((v) => v.user_id)
                        .filter((id) => !activeClaimerIds.has(id));
                    if (viewerIds.length > 0) {
                        sendNotificationBatch(viewerIds, "price_drop", postId, {
                            old_cost: currentCost.toFixed(2),
                            new_cost: parsed.toFixed(2),
                        });
                    }
                }
            }

            // N8: Notify notify_me watchers of price drop — exclude poster and active claimers
            const { data: watchers } = await supabase
                .from("notify_me")
                .select("user_id")
                .eq("post_id", postId);

            if (watchers && watchers.length > 0) {
                const watcherIds = watchers
                    .map((w) => w.user_id)
                    .filter((id) => id !== user?.id && !activeClaimerIds.has(id));
                if (watcherIds.length > 0) {
                    sendNotificationBatch(watcherIds, "price_drop", postId, {
                        old_cost: currentCost.toFixed(2),
                        new_cost: parsed.toFixed(2),
                    });
                }
            }

            setDiscountingPostId(null);
            setNewPrice("");
            fetchData();
        } catch {
            setActionError("Failed to update price.");
        }
        setActionLoading(null);
    }, [newPrice, fetchData, user]);

    const handleCancelPost = useCallback(async (postId: string, mode: "single" | "all_future" = "single") => {
        setActionLoading(postId);
        setActionError(null);

        try {
            if (mode === "single") {
                // Soft-delete just this post
                await supabase.from("posts").update({
                    status: "deleted",
                    deleted_at: new Date().toISOString(),
                    deleted_by: user?.id ?? null,
                }).eq("id", postId);

                // Notify claimers
                await notifyClaimersOfCancellation(postId);
            } else {
                // All future dates in this series
                const post = myPosts.find((p) => p.id === postId);
                if (!post?.series_id) {
                    // Not a series — just cancel this one
                    await supabase.from("posts").update({
                        status: "deleted",
                        deleted_at: new Date().toISOString(),
                        deleted_by: user?.id ?? null,
                    }).eq("id", postId);
                    await notifyClaimersOfCancellation(postId);
                } else {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    // Get all future series posts
                    const seriesPosts = myPosts.filter(
                        (p) => p.series_id === post.series_id && p.status === "active" && (p.game_date ?? "") >= todayStr,
                    );

                    let skippedCount = 0;
                    for (const sp of seriesPosts) {
                        const hasApproved = sp.claims.some((c) => c.status === "approved");
                        if (hasApproved) {
                            skippedCount++;
                            continue;
                        }
                        await supabase.from("posts").update({
                            status: "deleted",
                            deleted_at: new Date().toISOString(),
                            deleted_by: user?.id ?? null,
                        }).eq("id", sp.id);
                        await notifyClaimersOfCancellation(sp.id);
                    }

                    if (skippedCount > 0) {
                        setActionError(`${skippedCount} date${skippedCount > 1 ? "s" : ""} with approved claims ${skippedCount > 1 ? "were" : "was"} not cancelled.`);
                    }
                }
            }

            setCancellingPostId(null);
            fetchData();
        } catch {
            setActionError("Failed to cancel post.");
        }
        setActionLoading(null);
    }, [fetchData, user, myPosts]);

    const notifyClaimersOfCancellation = useCallback(async (postId: string) => {
        const { data: activeClaims } = await supabase
            .from("claims")
            .select("claimer_id")
            .eq("post_id", postId)
            .in("status", ["pending", "approved"]);

        if (activeClaims && activeClaims.length > 0) {
            const claimerIds = activeClaims.map((c) => c.claimer_id);
            sendNotificationBatch(claimerIds, "claimer_backed_out", postId, {
                post_summary: "This post has been cancelled by the poster. If payment has already been made via Venmo, please coordinate directly with your sub to arrange a refund.",
            });
        }
    }, []);

    // ── Render helpers ───────────────────────────────────────────────────────

    function renderPostCard(post: MyPost) {
        const pendingClaims = post.claims.filter((c) => c.status === "pending");
        const approvedClaims = post.claims.filter((c) => c.status === "approved");
        const dateDisplay = post.game_date ? formatDate(post.game_date) : "Date TBD";
        const timeDisplay = post.game_time ? formatTime(post.game_time) : null;
        const postState = derivePostState(post);
        const stateBadge = POST_STATE_BADGE[postState];
        const isReadOnly = postState === "completed" || postState === "expired" || postState === "cancelled";

        return (
            <div key={post.id} className={`rounded-xl border border-secondary bg-primary p-4 shadow-xs ${isReadOnly ? "opacity-75" : ""}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Badge color="brand" size="sm" type="pill-color">
                                {postLabel(post.play_type, post.format)}
                            </Badge>
                            {postState !== "active" && (
                                <Badge color={stateBadge.color} size="sm" type="pill-color">
                                    {stateBadge.label}
                                </Badge>
                            )}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-primary">
                            {dateDisplay}
                            {timeDisplay && <span className="font-normal text-secondary"> · {timeDisplay}</span>}
                        </p>
                        {(post.location || post.custom_court || post.duration != null) && (
                            <p className="text-xs text-tertiary">
                                {[post.location ?? post.custom_court, formatDuration(post.duration)]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        )}
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="text-xs text-tertiary">{post.spots_available}/{post.spots_total} open</div>
                        {/* Cost display with discount treatment */}
                        {post.cost != null && (
                            <div className="mt-0.5">
                                {post.original_cost != null && post.original_cost > post.cost ? (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-tertiary line-through">
                                            ${post.original_cost.toFixed(2)}
                                        </span>
                                        <span className="text-sm font-semibold text-success-primary">
                                            ${post.cost.toFixed(2)}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm font-semibold text-primary">${post.cost.toFixed(2)}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Post actions: Reduce price + Cancel */}
                {post.status === "active" && (
                    <div className="mt-2 flex items-center gap-2">
                        {discountingPostId === post.id ? (
                            <div className="flex flex-1 items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-secondary">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={post.cost ? post.cost - 0.01 : undefined}
                                        value={newPrice}
                                        onChange={(e) => setNewPrice(e.target.value)}
                                        placeholder="New price"
                                        className="h-8 w-20 rounded-lg border border-primary px-2 text-sm text-primary shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-solid"
                                    />
                                </div>
                                <Button
                                    color="primary"
                                    size="xs"
                                    onClick={() => handleReducePrice(post.id, post.cost!, post.original_cost)}
                                    isLoading={actionLoading === post.id}
                                    isDisabled={!newPrice}
                                >
                                    Save
                                </Button>
                                <Button
                                    color="secondary"
                                    size="xs"
                                    onClick={() => { setDiscountingPostId(null); setNewPrice(""); }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : cancellingPostId === post.id ? (
                            <div className="flex-1 space-y-2">
                                <p className="text-xs text-secondary">
                                    Cancel this post? All pending and approved claimers will be notified.
                                </p>
                                <p className="text-xs text-warning-primary">
                                    If payment has already been made via Venmo, please coordinate directly with your sub to arrange a refund.
                                </p>
                                {post.series_id ? (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-secondary">
                                            Cancel this date only or all future dates in this series?
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                color="primary-destructive"
                                                size="xs"
                                                onClick={() => handleCancelPost(post.id, "single")}
                                                isLoading={actionLoading === post.id}
                                                showTextWhileLoading
                                            >
                                                This date only
                                            </Button>
                                            <Button
                                                color="primary-destructive"
                                                size="xs"
                                                onClick={() => handleCancelPost(post.id, "all_future")}
                                                isLoading={actionLoading === post.id}
                                                showTextWhileLoading
                                            >
                                                All future dates
                                            </Button>
                                            <Button
                                                color="secondary"
                                                size="xs"
                                                onClick={() => setCancellingPostId(null)}
                                            >
                                                Keep post
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button
                                            color="primary-destructive"
                                            size="xs"
                                            onClick={() => handleCancelPost(post.id, "single")}
                                            isLoading={actionLoading === post.id}
                                            showTextWhileLoading
                                        >
                                            Yes, cancel post
                                        </Button>
                                        <Button
                                            color="secondary"
                                            size="xs"
                                            onClick={() => setCancellingPostId(null)}
                                        >
                                            Keep post
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <Link
                                    to={`/post/new?edit=${post.id}`}
                                    className="text-xs font-medium text-brand-secondary underline underline-offset-2"
                                >
                                    Edit
                                </Link>
                                {post.cost != null && post.cost > 0 && (
                                    <button
                                        className="text-xs font-medium text-brand-secondary underline underline-offset-2"
                                        onClick={() => { setDiscountingPostId(post.id); setNewPrice(""); }}
                                    >
                                        Reduce price
                                    </button>
                                )}
                                <button
                                    className="text-xs text-tertiary hover:text-error-primary"
                                    onClick={() => setCancellingPostId(post.id)}
                                >
                                    Cancel post
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Approved claims */}
                {approvedClaims.length > 0 && (
                    <div className="mt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tertiary">Approved</p>
                        {approvedClaims.map((claim) => (
                            <div key={claim.id} className="flex items-center gap-2 py-1.5">
                                {claim.photo_url ? (
                                    <img
                                        src={claim.photo_url}
                                        alt=""
                                        referrerPolicy="no-referrer"
                                        className="size-7 shrink-0 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-secondary">
                                        {claim.first_name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-primary">
                                        {claim.first_name} {claim.last_name}
                                    </span>
                                    {claim.skill_level && (
                                        <span className="ml-1.5 text-xs text-tertiary">{claim.skill_level} NTRP</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        className="text-xs font-semibold text-brand-secondary underline underline-offset-2"
                                        onClick={() => handleShowApprovedContact(claim, post)}
                                    >
                                        Details
                                    </button>
                                    {reopeningClaimId === claim.id ? (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-tertiary">Reopen?</span>
                                            <button
                                                className="text-xs font-semibold text-error-primary"
                                                onClick={() => handleReopen(claim.id, claim.claimer_id, post.id)}
                                                disabled={actionLoading === claim.id}
                                            >
                                                Yes
                                            </button>
                                            <button
                                                className="text-xs text-tertiary"
                                                onClick={() => setReopeningClaimId(null)}
                                            >
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="text-xs text-tertiary hover:text-secondary"
                                            onClick={() => setReopeningClaimId(claim.id)}
                                        >
                                            Reopen spot
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pending claims */}
                {pendingClaims.length > 0 && (
                    <div className="mt-3">
                        {approvedClaims.length > 0 && <hr className="mb-3 border-secondary" />}
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tertiary">
                            {pendingClaims.length} pending {pendingClaims.length === 1 ? "claim" : "claims"}
                        </p>
                        {pendingClaims.map((claim) => (
                            <div key={claim.id} className="py-2">
                                <div className="flex items-center gap-2">
                                    {claim.photo_url ? (
                                        <img
                                            src={claim.photo_url}
                                            alt=""
                                            referrerPolicy="no-referrer"
                                            className="size-8 shrink-0 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-secondary">
                                            {claim.first_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary">
                                            {claim.first_name} {claim.last_name}
                                        </p>
                                        {claim.skill_level && (
                                            <p className="text-xs text-tertiary">{claim.skill_level} NTRP</p>
                                        )}
                                    </div>
                                </div>

                                {/* Reject reason selector */}
                                {rejectingClaimId === claim.id ? (
                                    <div className="mt-2 space-y-2">
                                        <p className="text-xs text-secondary">Select a reason:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {REJECTION_REASONS.map((r) => (
                                                <button
                                                    key={r}
                                                    onClick={() => setSelectedReason(r)}
                                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                                        selectedReason === r
                                                            ? "border-brand bg-brand-primary text-brand-secondary"
                                                            : "border-secondary text-secondary"
                                                    }`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                color="primary-destructive"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleReject(claim.id, claim.claimer_id, post.id)}
                                                isLoading={actionLoading === claim.id}
                                                showTextWhileLoading
                                            >
                                                Confirm reject
                                            </Button>
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                onClick={() => setRejectingClaimId(null)}
                                            >
                                                Back
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            color="primary"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleApprove(claim.id, claim, post)}
                                            isLoading={actionLoading === claim.id}
                                            showTextWhileLoading
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleStartReject(claim.id)}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {pendingClaims.length === 0 && approvedClaims.length === 0 && (
                    <p className="mt-3 text-sm text-tertiary">No claims yet.</p>
                )}
            </div>
        );
    }

    function renderClaimCard(claim: MyClaim) {
        const dateDisplay = claim.game_date ? formatDate(claim.game_date) : "Date TBD";
        const timeDisplay = claim.game_time ? formatTime(claim.game_time) : null;
        const isActive = claim.status === "pending" || claim.status === "approved";

        return (
            <div key={claim.id} className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <Badge color="brand" size="sm" type="pill-color">
                            {postLabel(claim.play_type, claim.format)}
                        </Badge>
                        <p className="mt-1.5 text-sm font-semibold text-primary">
                            {dateDisplay}
                            {timeDisplay && <span className="font-normal text-secondary"> · {timeDisplay}</span>}
                        </p>
                        {(claim.location || claim.custom_court || claim.duration != null) && (
                            <p className="text-xs text-tertiary">
                                {[claim.location ?? claim.custom_court, formatDuration(claim.duration)]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        )}
                        {claim.cost != null && (
                            <p className="mt-0.5 text-xs font-semibold text-primary">${claim.cost.toFixed(2)}</p>
                        )}
                    </div>
                    <div className="shrink-0">{claimStatusBadge(claim.status)}</div>
                </div>

                {/* Poster */}
                <div className="mt-3 flex items-center gap-2">
                    {claim.poster_photo_url ? (
                        <img
                            src={claim.poster_photo_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="size-6 shrink-0 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-secondary">
                            {claim.poster_first_name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="text-xs text-secondary">
                        Posted by {claim.poster_first_name} {claim.poster_last_name}
                    </span>
                </div>

                {claim.status === "rejected" && claim.rejection_reason && (
                    <p className="mt-2 text-xs text-error-primary">
                        Reason: {claim.rejection_reason}
                    </p>
                )}

                {/* Scenario B: Spot reopened by poster — only shown in claimer's own view */}
                {claim.status === "cancelled" && isReopenedClaim({ status: claim.status, post_status: claim.post_status }) && (
                    <p className="mt-2 text-xs text-warning-primary">
                        The poster reopened this spot after approving your claim.
                    </p>
                )}

                {/* Venmo deep link for approved claims */}
                {claim.status === "approved" && claim.poster_venmo_handle && claim.cost != null && (
                    <div className="mt-2">
                        <a
                            href={`https://venmo.com/${claim.poster_venmo_handle}?txn=pay&amount=${claim.cost.toFixed(2)}&note=CourtPlay%20-%20${encodeURIComponent(claim.location ?? claim.custom_court ?? "Tennis")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-solid_hover"
                        >
                            Pay ${claim.cost.toFixed(2)} via Venmo
                        </a>
                    </div>
                )}

                {/* Actions */}
                {isActive && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {claim.status === "approved" && unclaimingId !== claim.id && (
                            <Button
                                color="secondary"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleViewClaimDetails(claim)}
                            >
                                View details
                            </Button>
                        )}

                        {unclaimingId === claim.id ? (
                            <div className="flex w-full flex-wrap items-center gap-2">
                                <span className="flex-1 text-xs text-secondary">
                                    The poster will be notified and the spot will reopen.
                                </span>
                                <Button
                                    color="primary-destructive"
                                    size="sm"
                                    onClick={() => handleUnclaim(claim.id, claim.poster_id, claim.post_id, claim.status)}
                                    isLoading={actionLoading === claim.id}
                                    showTextWhileLoading
                                >
                                    Yes, back out
                                </Button>
                                <Button
                                    color="secondary"
                                    size="sm"
                                    onClick={() => setUnclaimingId(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button
                                color={claim.status === "approved" ? "secondary" : "tertiary"}
                                size="sm"
                                className={claim.status === "approved" ? "" : "flex-1"}
                                onClick={() => setUnclaimingId(claim.id)}
                            >
                                Back out
                            </Button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout>
            {/* Tab bar */}
            <div className="sticky top-0 z-10 flex border-b border-secondary bg-primary">
                <button
                    onClick={() => setTab("posts")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                        tab === "posts"
                            ? "border-b-2 border-brand text-brand-secondary"
                            : "text-tertiary"
                    }`}
                >
                    My Posts
                </button>
                <button
                    onClick={() => setTab("claims")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                        tab === "claims"
                            ? "border-b-2 border-brand text-brand-secondary"
                            : "text-tertiary"
                    }`}
                >
                    My Claims
                </button>
            </div>

            {/* Action error toast */}
            {actionError && (
                <div className="mx-4 mt-3 rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                    {actionError}
                </div>
            )}

            <div className="flex flex-col gap-3 px-4 py-4">
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
                ) : tab === "posts" ? (
                    myPosts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <p className="text-base font-semibold text-primary">No posts yet</p>
                            <p className="text-sm text-tertiary">You haven't posted any sub needs yet.</p>
                            <Link
                                to="/post/new"
                                className="mt-1 rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                            >
                                Find a Sub
                            </Link>
                        </div>
                    ) : (() => {
                        // Group series posts
                        const seriesMap = new Map<string, MyPost[]>();
                        const standalone: MyPost[] = [];
                        for (const p of myPosts) {
                            if (p.series_id) {
                                const arr = seriesMap.get(p.series_id) ?? [];
                                arr.push(p);
                                seriesMap.set(p.series_id, arr);
                            } else {
                                standalone.push(p);
                            }
                        }
                        // Flatten: standalone + series groups (sorted by first post date)
                        const groups: Array<{ type: "single"; post: MyPost } | { type: "series"; seriesId: string; posts: MyPost[] }> = [];
                        for (const p of standalone) groups.push({ type: "single", post: p });
                        for (const [sid, posts] of seriesMap) {
                            posts.sort((a, b) => (a.game_date ?? "").localeCompare(b.game_date ?? ""));
                            groups.push({ type: "series", seriesId: sid, posts });
                        }

                        return (
                            <ul className="flex flex-col gap-3">
                                {groups.map((g) =>
                                    g.type === "single" ? (
                                        <li key={g.post.id}>{renderPostCard(g.post)}</li>
                                    ) : (
                                        <li key={g.seriesId}>
                                            <div className="mb-2 flex items-center gap-2">
                                                <Badge color="brand" size="sm" type="pill-color">
                                                    Series: {g.posts.length} dates
                                                </Badge>
                                            </div>
                                            <ul className="flex flex-col gap-2">
                                                {g.posts.map((p) => (
                                                    <li key={p.id}>{renderPostCard(p)}</li>
                                                ))}
                                            </ul>
                                        </li>
                                    ),
                                )}
                            </ul>
                        );
                    })()
                ) : myClaims.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <p className="text-base font-semibold text-primary">No claims yet</p>
                        <p className="text-sm text-tertiary">You haven't claimed any spots yet.</p>
                        <Link
                            to="/feed"
                            className="mt-1 rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                        >
                            Browse the feed
                        </Link>
                    </div>
                ) : (
                    (() => {
                        const pending = myClaims.filter((c) => c.status === "pending");
                        const approved = myClaims.filter((c) => c.status === "approved");
                        const completed = myClaims.filter((c) => c.status === "rejected" || c.status === "cancelled");
                        const backedOut = myClaims.filter((c) => c.status === "unclaimed");

                        const sections = [
                            { label: "Pending", claims: pending },
                            { label: "Approved", claims: approved },
                            { label: "Completed", claims: completed },
                            { label: "Backed out", claims: backedOut },
                        ].filter((s) => s.claims.length > 0);

                        return (
                            <div className="flex flex-col gap-4">
                                {sections.map((section) => (
                                    <div key={section.label}>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tertiary">
                                            {section.label} ({section.claims.length})
                                        </p>
                                        <ul className="flex flex-col gap-3">
                                            {section.claims.map((claim) => (
                                                <li key={claim.id}>{renderClaimCard(claim)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        );
                    })()
                )}
            </div>

            {contactModal && (
                <ContactModal
                    info={contactModal}
                    onClose={handleCloseContactModal}
                />
            )}
        </AppLayout>
    );
}
