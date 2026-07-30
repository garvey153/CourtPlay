/**
 * Which channels each notification type uses when a user has no preference row.
 *
 * Lives here rather than in send-notification so the app's test suite can import
 * it — it has no Deno or Supabase dependencies, the same trick used for
 * notification-recipients.ts. The client mirrors these values in
 * NOTIFICATION_TYPES (src/lib/notifications.ts) to render the preferences screen,
 * and notification-defaults.test.ts asserts the two agree. They are one decision
 * expressed on both sides of the network, and they drifted before.
 */

export type NotificationType =
    | "claim_submitted"
    | "claim_approved"
    | "claim_rejected"
    | "approval_cancelled"
    | "claimer_backed_out"
    | "cost_changed"
    | "nudge_no_response"
    | "claimer_cancelled"
    | "price_drop"
    | "spot_reopened"
    | "48h_unfilled"
    | "game_reminder"
    | "friend_expiry"
    | "friend_new_post"
    | "connection_request"
    | "connection_closed"
    | "connection_withdrawn"
    | "feedback_submitted";

export const DEFAULT_CHANNELS: Record<NotificationType, { push: boolean; email: boolean }> = {
    // Claim lifecycle (claimed / approved / declined) pushes by default.
    claim_submitted:    { push: true, email: true },
    claim_approved:     { push: true, email: true },
    claim_rejected:     { push: true, email: true },
    approval_cancelled: { push: true, email: true },   // claim lifecycle — same as approve/reject
    claimer_backed_out: { push: false, email: true },
    cost_changed:       { push: false, email: true },
    nudge_no_response:  { push: false, email: true },
    claimer_cancelled:  { push: false, email: true },
    price_drop:         { push: false, email: true },
    spot_reopened:      { push: false, email: true },
    "48h_unfilled":     { push: false, email: true },
    game_reminder:      { push: false, email: true },
    friend_expiry:      { push: false, email: true },
    friend_new_post:    { push: false, email: false }, // N13 defaults to off
    connection_request: { push: true, email: true },   // N14 — like a new claim
    connection_closed:  { push: false, email: true },  // N15
    connection_withdrawn: { push: false, email: true }, // N16 — informational, like connection_closed
    feedback_submitted: { push: true, email: true },   // N16 — admin-only
};
