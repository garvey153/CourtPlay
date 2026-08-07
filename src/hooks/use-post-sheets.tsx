import { type ReactNode, useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { CreatedDetailSheet } from "@/components/app/created-detail-sheet";
import { RegularPlaySheet } from "@/components/app/regular-play-sheet";
import { RegularConnectionsSheet } from "@/components/app/regular-connections-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { REJECTION_REASONS } from "@/types/claims";
import type { ClaimRow, MyClaim, MyPost } from "@/types/activity";
import type { FeedPost } from "@/types/feed";

interface UsePostSheetsOptions {
    /** Refresh the caller's own list(s) after any claim/post change. */
    onChanged?: () => void;
    /** Where the edit form returns to after editing a created post (default "/feed"). */
    editReturnTo?: string;
    /** Called after the viewer cancels their own claim (caller can show a "reopened" banner). */
    onClaimCancelled?: (post: FeedPost) => void;
}

/**
 * Encapsulates the post bottom-sheet flow shared by the feed and profile: tapping a
 * card opens the creator sheet for your own post (approve/decline/edit/delete) or the
 * claim/connect sheet for someone else's. Returns `openDetail` (wire to SubCard's
 * onOpenDetail) and `sheets` (render once in the tree).
 */
export function usePostSheets({ onChanged, editReturnTo = "/feed", onClaimCancelled }: UsePostSheetsOptions = {}) {
    const { user } = useAuth();
    const { profile } = useProfile();
    const navigate = useNavigate();

    const [detailPost, setDetailPost] = useState<FeedPost | null>(null);
    const [createdSheet, setCreatedSheet] = useState<MyPost | null>(null);
    // The seeker's own regular-play post → conversation-list sheet (not the sub creator sheet).
    const [regularSheet, setRegularSheet] = useState<MyPost | null>(null);
    const [claimContact, setClaimContact] = useState<{ venmoHandle: string | null; phone: string | null } | null>(null);
    const [claimMessages, setClaimMessages] = useState<MyClaim["messages"] | undefined>(undefined);
    const [createdActionLoading, setCreatedActionLoading] = useState<string | null>(null);
    const [deletingCreated, setDeletingCreated] = useState(false);

    const openDetail = useCallback(
        async (post: FeedPost) => {
            // Someone else's post → claim / connect sheet.
            if (!user || post.author_id !== user.id) {
                const { data } = await supabase.rpc("get_my_claims_with_posts");
                const mine = ((data as MyClaim[]) ?? []).find((c) => c.post_id === post.id);
                setClaimMessages(mine?.messages);
                setClaimContact(
                    mine?.status === "approved"
                        ? { venmoHandle: mine.poster_venmo_handle, phone: mine.poster_phone }
                        : null,
                );
                setDetailPost(post);
                return;
            }
            // My own post → creator sheet (needs the post's claims). Regular-play
            // posts (many responders, no approval) use the conversation-list sheet.
            const { data } = await supabase.rpc("get_my_posts_with_claims");
            const mine = ((data as MyPost[]) ?? []).find((p) => p.id === post.id);
            if (mine) {
                if (mine.post_type === "regular_game") setRegularSheet(mine);
                else setCreatedSheet(mine);
            } else setDetailPost(post);
        },
        [user],
    );

    const refreshCreated = useCallback(async (postId: string) => {
        const { data } = await supabase.rpc("get_my_posts_with_claims");
        setCreatedSheet(((data as MyPost[]) ?? []).find((p) => p.id === postId) ?? null);
    }, []);

    const refreshRegular = useCallback(async (postId: string) => {
        const { data } = await supabase.rpc("get_my_posts_with_claims");
        setRegularSheet(((data as MyPost[]) ?? []).find((p) => p.id === postId) ?? null);
    }, []);

    // Seeker replies in one responder's thread on their regular post.
    const handleRegularReply = useCallback(
        async (post: MyPost, claimId: string, body: string) => {
            await supabase.rpc("send_claim_message", { p_claim_id: claimId, p_body: body });
            await refreshRegular(post.id);
        },
        [refreshRegular],
    );

    const handleApprove = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setCreatedActionLoading(claim.id);
            const { data, error } = await supabase.rpc("approve_claim", { p_claim_id: claim.id });
            if (!error && data?.success) {
                sendNotification({ notification_type: "claim_approved", claim_id: claim.id });
                // N21 — and the group playing with the sub, who were told when
                // it was claimed and are owed the outcome.
                sendNotification({ notification_type: "tagged_claim_approved", post_id: post.id });
                onChanged?.();
                await refreshCreated(post.id);
            }
            setCreatedActionLoading(null);
        },
        [onChanged, refreshCreated],
    );

    const handleDecline = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setCreatedActionLoading(claim.id);
            const { data, error } = await supabase.rpc("reject_claim", { p_claim_id: claim.id, p_reason: REJECTION_REASONS[0] });
            if (!error && data?.success) {
                sendNotification({ notification_type: "claim_rejected", claim_id: claim.id });
                // Declining frees the spot: spots_available counts pending and
                // approved claims alike, so a rejected pending claim reopens one.
                sendNotification({ notification_type: "spot_reopened", post_id: post.id });
                setCreatedSheet(null);
                onChanged?.();
            }
            setCreatedActionLoading(null);
        },
        [onChanged],
    );

    const handleCancelApproval = useCallback(
        async (claim: ClaimRow, post: MyPost) => {
            setCreatedActionLoading(claim.id);
            const { data, error } = await supabase.rpc("cancel_approval", { p_claim_id: claim.id });
            if (!error && data?.success) {
                // Tell the claimer: cancel_approval sets the claim back to
                // pending, so their spot isn't gone, it's undecided again.
                sendNotification({ notification_type: "approval_cancelled", claim_id: claim.id });
                onChanged?.();
                await refreshCreated(post.id);
            }
            setCreatedActionLoading(null);
        },
        [onChanged, refreshCreated],
    );

    const handleReply = useCallback(
        async (post: MyPost, body: string) => {
            const c = post.claims.find((x) => x.status === "pending" || x.status === "approved");
            if (!c) return;
            await supabase.rpc("send_claim_message", { p_claim_id: c.id, p_body: body });
            await refreshCreated(post.id);
        },
        [refreshCreated],
    );

    const handleDelete = useCallback(
        async (post: MyPost) => {
            if (!user) return;
            setDeletingCreated(true);
            const { error } = await supabase
                .from("posts")
                .update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: user.id })
                .eq("id", post.id);
            setDeletingCreated(false);
            if (!error) {
                // A seeker removing their regular post = they found a spot. Let the
                // responders they were talking to know the conversation is closed.
                if (post.post_type === "regular_game" && post.claims.length > 0) {
                    sendNotification({ notification_type: "connection_closed", post_id: post.id });
                }
                setCreatedSheet(null);
                setRegularSheet(null);
                onChanged?.();
            }
        },
        [user, profile, onChanged],
    );

    const closeSheets = useCallback(() => {
        setDetailPost(null);
        setCreatedSheet(null);
        setRegularSheet(null);
        setClaimContact(null);
        setClaimMessages(undefined);
    }, []);

    const sheets: ReactNode = (
        <>
            {detailPost &&
                (detailPost.post_type === "sub_need" ? (
                    <ClaimDetailSheet
                        post={detailPost}
                        contact={claimContact ?? undefined}
                        messages={claimMessages}
                        currentUser={
                            profile
                                ? { first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }
                                : undefined
                        }
                        currentUserId={user?.id}
                        onClose={() => {
                            setDetailPost(null);
                            setClaimContact(null);
                            setClaimMessages(undefined);
                        }}
                        onClaimChange={() => onChanged?.()}
                        onCancelled={(p) => {
                            setDetailPost(null);
                            setClaimContact(null);
                            setClaimMessages(undefined);
                            onChanged?.();
                            onClaimCancelled?.(p);
                        }}
                    />
                ) : (
                    <RegularPlaySheet
                        post={detailPost}
                        currentUserId={user?.id}
                        messages={claimMessages}
                        currentUser={
                            profile
                                ? { first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }
                                : undefined
                        }
                        onClose={() => {
                            setDetailPost(null);
                            setClaimMessages(undefined);
                        }}
                        onChange={() => onChanged?.()}
                    />
                ))}

            {createdSheet && profile && (
                <CreatedDetailSheet
                    post={createdSheet}
                    poster={{ first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }}
                    actionLoading={createdActionLoading}
                    deleting={deletingCreated}
                    onClose={() => setCreatedSheet(null)}
                    onApprove={(claim) => handleApprove(claim, createdSheet)}
                    onDecline={(claim) => handleDecline(claim, createdSheet)}
                    onCancelApproval={(claim) => handleCancelApproval(claim, createdSheet)}
                    onEdit={() => navigate(`/post/new?edit=${createdSheet.id}`, { state: { returnTo: editReturnTo } })}
                    onDelete={() => handleDelete(createdSheet)}
                    onReply={(body) => handleReply(createdSheet, body)}
                />
            )}

            {regularSheet && profile && (
                <RegularConnectionsSheet
                    post={regularSheet}
                    poster={{ first_name: profile.first_name, last_name: profile.last_name, photo_url: profile.photo_url }}
                    deleting={deletingCreated}
                    onClose={() => setRegularSheet(null)}
                    onEdit={() => navigate(`/post/new?edit=${regularSheet.id}`, { state: { returnTo: editReturnTo } })}
                    onDelete={() => handleDelete(regularSheet)}
                    onReply={(claimId, body) => handleRegularReply(regularSheet, claimId, body)}
                />
            )}
        </>
    );

    return { openDetail, sheets, closeSheets };
}
