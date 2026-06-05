/**
 * Derived display states for My Activity screen.
 * These map database field combinations to user-facing state labels.
 */

export type PostDisplayState =
    | "active"       // Active, no claims
    | "pending"      // Active, has pending claims only
    | "claimed"      // Active, has approved claim(s), spots still available
    | "filled"       // Active, all spots filled
    | "completed"    // Expired, had approved claims (game happened)
    | "expired"      // Expired, no approved claims
    | "cancelled";   // Deleted by poster or admin

export type ClaimDisplayState =
    | "pending"      // Pending, game upcoming
    | "approved"     // Approved, game upcoming
    | "completed"    // Approved, game date passed
    | "backed_out"   // Claimer unclaimed
    | "rejected"     // Rejected by poster
    | "cancelled";   // Cancelled (post deleted or spot reopened)

interface PostForState {
    status: string;
    spots_available: number;
    claims: Array<{ status: string }>;
}

interface ClaimForState {
    status: string;
    game_date: string | null;
}

export function derivePostState(post: PostForState): PostDisplayState {
    if (post.status === "deleted") return "cancelled";
    if (post.status === "expired") {
        const hasApproved = post.claims.some((c) => c.status === "approved");
        return hasApproved ? "completed" : "expired";
    }

    // Active post states
    const hasApproved = post.claims.some((c) => c.status === "approved");
    const hasPending = post.claims.some((c) => c.status === "pending");

    if (hasApproved && post.spots_available === 0) return "filled";
    if (hasApproved) return "claimed";
    if (hasPending) return "pending";
    return "active";
}

export function deriveClaimState(claim: ClaimForState): ClaimDisplayState {
    if (claim.status === "unclaimed") return "backed_out";
    if (claim.status === "rejected") return "rejected";
    if (claim.status === "cancelled") return "cancelled";
    if (claim.status === "pending") return "pending";

    // Approved — check if game is completed (date passed)
    if (claim.status === "approved") {
        if (claim.game_date) {
            const today = new Date().toISOString().slice(0, 10);
            if (claim.game_date < today) return "completed";
        }
        return "approved";
    }

    return "pending";
}

/**
 * Check if a cancelled claim was due to a spot reopen (Scenario B)
 * vs a post deletion. Only relevant for cancelled claims.
 */
export function isReopenedClaim(claim: { status: string; post_status?: string }): boolean {
    // A reopen-cancelled claim has status='cancelled' but the post is still active
    // A post-deletion-cancelled claim has status='cancelled' and the post is deleted
    return claim.status === "cancelled" && claim.post_status === "active";
}

export const POST_STATE_BADGE: Record<PostDisplayState, { label: string; color: "brand" | "warning" | "success" | "gray" | "error" }> = {
    active: { label: "Active", color: "brand" },
    pending: { label: "Pending claims", color: "warning" },
    claimed: { label: "Claimed", color: "success" },
    filled: { label: "Filled", color: "success" },
    completed: { label: "Completed", color: "gray" },
    expired: { label: "Expired", color: "gray" },
    cancelled: { label: "Cancelled", color: "error" },
};
