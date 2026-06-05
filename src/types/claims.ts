export interface Claim {
    id: string;
    post_id: string;
    claimer_id: string;
    status: ClaimStatus;
    rejection_reason: RejectionReason | null;
    reopen_note: string | null;
    created_at: string;
    resolved_at: string | null;
}

export type ClaimStatus = "pending" | "approved" | "rejected" | "unclaimed" | "cancelled";

export type RejectionReason = "Wrong skill level" | "Already filled" | "Other";

export const REJECTION_REASONS: readonly RejectionReason[] = [
    "Wrong skill level",
    "Already filled",
    "Other",
] as const;
