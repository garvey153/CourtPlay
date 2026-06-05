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
    | "friend_new_post";      // N13

export type NotificationChannel = "push" | "email";

interface NotificationPayload {
    user_id: string;
    notification_type: NotificationType;
    post_id?: string;
    claim_id?: string;
    data?: Record<string, unknown>;
}

/**
 * Dispatches a notification via the Supabase Edge Function.
 * Fire-and-forget — errors are logged but don't block the caller.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
    try {
        await supabase.functions.invoke("send-notification", {
            body: payload,
        });
    } catch (e) {
        console.warn("Notification dispatch failed:", e);
    }
}

/**
 * Dispatches notifications to multiple users (e.g., notify_me watchers).
 * Fire-and-forget.
 */
export async function sendNotificationBatch(
    userIds: string[],
    notification_type: NotificationType,
    post_id?: string,
    data?: Record<string, string>,
): Promise<void> {
    await Promise.allSettled(
        userIds.map((user_id) =>
            sendNotification({ user_id, notification_type, post_id, data }),
        ),
    );
}
