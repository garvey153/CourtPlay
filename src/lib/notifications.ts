import { supabase } from "./supabase";

export type NotificationType =
    | "claim_submitted"       // N1
    | "claim_approved"        // N2
    | "claim_rejected"        // N3
    | "approval_cancelled"    // N3b — poster withdraws an approval they granted
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
    | "connection_withdrawn"  // N16 — responder withdraws their connection
    | "feedback_submitted";   // N16 — admin-only: a player submitted feedback

export type NotificationChannel = "push" | "email";

export interface NotificationTypeMeta {
    key: NotificationType;
    label: string;
    hint: string;
    defaultEmail: boolean;
    defaultPush: boolean;
    /** Rendered only for admins, and never seeded during onboarding. */
    adminOnly?: boolean;
}

/**
 * The single registry of notification types.
 *
 * There were four lists of these and three disagreed: onboarding seeded
 * preference rows for `nudge_12h` and `nudge_48h` (neither is a real type — they
 * are `nudge_no_response` and `48h_unfilled`) while omitting six real ones, and
 * the preferences screen was missing `connection_request` and
 * `connection_closed` entirely, so those fired with no way to opt out.
 *
 * The practical consequence was silent: a type absent from onboarding's list got
 * no preference row, so the push/email choice made during onboarding didn't
 * apply to it and the server fell back to its own defaults instead.
 *
 * `defaultEmail`/`defaultPush` must match DEFAULT_CHANNELS in
 * supabase/functions/_shared/notification-defaults.ts — they are the same
 * decision on either side of the network. notification-defaults.test.ts asserts
 * it, importing both.
 */
export const NOTIFICATION_TYPES: readonly NotificationTypeMeta[] = [
    { key: "claim_submitted", label: "New claim on your post", hint: "When someone claims a spot you posted", defaultEmail: true, defaultPush: true },
    { key: "claim_approved", label: "Claim approved", hint: "When a poster approves your claim", defaultEmail: true, defaultPush: true },
    { key: "claim_rejected", label: "Claim rejected", hint: "When a poster rejects your claim", defaultEmail: true, defaultPush: true },
    { key: "approval_cancelled", label: "Approval withdrawn", hint: "When a poster withdraws an approval they gave you", defaultEmail: true, defaultPush: true },
    { key: "claimer_backed_out", label: "Claimer backed out", hint: "When an approved claimer withdraws from your post", defaultEmail: true, defaultPush: false },
    { key: "cost_changed", label: "Cost changed", hint: "When the cost changes on a post you claimed", defaultEmail: true, defaultPush: false },
    { key: "nudge_no_response", label: "Claim response reminder", hint: "Reminder to respond to pending claims on your posts", defaultEmail: true, defaultPush: false },
    { key: "claimer_cancelled", label: "Claimer cancelled", hint: "When a claimer cancels their pending claim on your post", defaultEmail: true, defaultPush: false },
    { key: "price_drop", label: "Price drop", hint: "When a post you viewed reduces its price", defaultEmail: true, defaultPush: false },
    { key: "spot_reopened", label: "Spot reopened", hint: "When a spot opens up on a post you're watching", defaultEmail: true, defaultPush: false },
    { key: "48h_unfilled", label: "48h unfilled nudge", hint: "Reminder when your post has been up 48 hours with no claims", defaultEmail: true, defaultPush: false },
    { key: "game_reminder", label: "Game reminder", hint: "Reminder the day before a game", defaultEmail: true, defaultPush: false },
    { key: "friend_expiry", label: "Friend's game filling up", hint: "When a friend's post is close to game time with open spots", defaultEmail: true, defaultPush: false },
    { key: "friend_new_post", label: "Friend posts new sub need", hint: "When a friend creates a new sub need post", defaultEmail: false, defaultPush: false },
    // Added here because they were missing from the preferences screen entirely,
    // despite firing since the regular-post connections feature shipped.
    { key: "connection_request", label: "New connection request", hint: "When someone responds to your regular play post", defaultEmail: true, defaultPush: true },
    { key: "connection_closed", label: "Group filled up", hint: "When a regular play post you responded to closes", defaultEmail: true, defaultPush: false },
    { key: "connection_withdrawn", label: "Connection withdrawn", hint: "When someone withdraws their response to your regular play post", defaultEmail: true, defaultPush: false },
    { key: "feedback_submitted", label: "New feedback", hint: "When a player submits feedback", defaultEmail: true, defaultPush: true, adminOnly: true },
] as const;

/** Types seeded during onboarding — everything a normal player can receive. */
export const SEEDED_NOTIFICATION_TYPES: readonly NotificationType[] =
    NOTIFICATION_TYPES.filter((t) => !t.adminOnly).map((t) => t.key);


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
    /**
     * Recipients whose push was attempted and declined. Counted separately
     * because `delivered` is satisfied by either channel, so a push that failed
     * while the email landed does not show up in it at all.
     */
    pushFailed: number;
}

/** Per-recipient detail, only inspected to report a declined push. */
interface Delivery {
    user_id?: string;
    pushSent?: boolean;
    results?: { push?: { onesignal?: unknown } };
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
        // OneSignal answers 200 with an `errors` array when nobody is reachable,
        // so a declined push is not an HTTP failure and nothing above catches it.
        // The detail is in the response and was simply being thrown away — which
        // is how a claim_approved push went missing with no trace anywhere.
        const deliveries = (data?.deliveries ?? []) as Delivery[];
        for (const d of deliveries) {
            if (!d.pushSent && d.results?.push) {
                console.warn(
                    "Push not delivered:",
                    request.notification_type,
                    d.user_id,
                    d.results.push.onesignal,
                );
            }
        }

        return {
            recipients: data?.recipients ?? 0,
            delivered: data?.delivered ?? 0,
            pushFailed: data?.pushFailed ?? 0,
        };
    } catch (e) {
        console.warn("Notification dispatch threw:", e);
        return null;
    }
}
