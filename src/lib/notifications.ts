import { supabase } from "./supabase";

export type NotificationType =
    | "claim_submitted"       // N1
    | "claim_approved"        // N2
    | "claim_rejected"        // N3
    | "claimer_backed_out"    // N4
    | "cost_changed"          // N5
    | "nudge_no_response"     // N6
    | "claimer_cancelled"     // N7
    | "price_drop"            // N8
    | "spot_reopened"         // N9
    | "48h_unfilled"          // N10
    | "game_reminder"         // N11
    | "friend_expiry"         // N12
    | "friend_new_post"       // N13
    | "connection_request"    // N14 — responder taps Connect on a regular post
    | "connection_closed"     // N15 — seeker removes their regular post (spot found)
    | "feedback_submitted";   // N16 — admin-only: a player submitted feedback

export type NotificationChannel = "push" | "email";

/**
 * What the client is allowed to say.
 *
 * It names a type and points at a row it already has a relationship to. It does
 * NOT choose the recipient or write the copy — the edge function checks the
 * caller is entitled to trigger this notification on this row, then derives both
 * from the row itself. Passing `user_id` or a `data` blob used to be how this
 * worked, and it meant anyone holding the anon key from the bundle could push
 * and email arbitrary text at any user.
 *
 * The one exception is `old_cost`: the edit writes `posts.cost` in place, so the
 * previous price is genuinely gone by the time the server looks. It is display
 * only, and the server still verifies the caller owns the post it describes.
 */
interface NotificationRequest {
    notification_type: NotificationType;
    post_id?: string;
    claim_id?: string;
    old_cost?: string;
}

export interface DispatchResult {
    /** How many users the server decided should be notified. */
    recipients: number;
    /** How many of those got at least one channel through. */
    delivered: number;
}

/**
 * Asks the server to send a notification.
 *
 * Fire-and-forget by default — the triggering action has already succeeded, so a
 * failed notification must not fail it. `functions.invoke` resolves with
 * `{ data, error }` rather than throwing, so the error is checked explicitly;
 * it previously wasn't, which is how a CORS preflight failure silently dropped
 * every notification for months.
 */
export async function sendNotification(request: NotificationRequest): Promise<DispatchResult | null> {
    try {
        const { data, error } = await supabase.functions.invoke("send-notification", {
            body: request,
        });
        if (error) {
            console.warn("Notification dispatch failed:", request.notification_type, error.message);
            return null;
        }
        return { recipients: data?.recipients ?? 0, delivered: data?.delivered ?? 0 };
    } catch (e) {
        console.warn("Notification dispatch threw:", e);
        return null;
    }
}
