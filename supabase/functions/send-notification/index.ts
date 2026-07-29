import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsJson, handlePreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Bump on every deploy. Edge functions have no equivalent of the frontend's
 * __BUILD_ID__, so without this there's no way to tell a stale deploy from a
 * genuine failure — which already cost us one wrong diagnosis. Echoed in test
 * responses, including the rejection path, so freshness is checkable with a
 * curl and an anon key.
 */
const FN_BUILD = "2026-07-29f";

type NotificationType =
    | "claim_submitted"
    | "claim_approved"
    | "claim_rejected"
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
    | "feedback_submitted";

interface TemplateConfig {
    title: string;
    body: (d: Record<string, string>) => string;
    subject: (d: Record<string, string>) => string;
    deepLink: (postId?: string) => string;
}

// Notification content templates
const TEMPLATES: Record<NotificationType, TemplateConfig> = {
    claim_submitted: {
        title: "Someone claimed your post!",
        body: (d) => d.claimer_name
            ? `${d.claimer_name} wants to claim your open spot${d.post_summary ? ` — ${d.post_summary}` : ""}. Review it now.`
            : "Someone wants to claim your open spot. Review it now.",
        subject: (d) => d.post_summary
            ? `Someone claimed your spot at ${d.post_summary}`
            : "Someone claimed your CourtPlay spot",
        deepLink: () => "https://courtplay.app/activity",
    },
    claim_approved: {
        title: "Claim approved!",
        body: (d) => {
            let msg = d.poster_name
                ? `${d.poster_name} approved your claim`
                : "Your claim has been approved";
            if (d.post_summary) msg += ` for ${d.post_summary}`;
            msg += ". Check the details for contact info and payment.";
            return msg;
        },
        subject: (d) => d.post_summary
            ? `Your CourtPlay claim for ${d.post_summary} was approved`
            : "Your CourtPlay claim was approved",
        deepLink: () => "https://courtplay.app/activity",
    },
    claim_rejected: {
        title: "Claim not approved.",
        body: (d) => {
            let msg = "Your claim was not approved";
            if (d.post_summary) msg += ` for ${d.post_summary}`;
            if (d.reason) msg += `. Reason: ${d.reason}`;
            else msg += ".";
            return msg;
        },
        subject: (d) => d.post_summary
            ? `CourtPlay claim update — ${d.post_summary}`
            : "CourtPlay claim update",
        deepLink: () => "https://courtplay.app/activity",
    },
    claimer_backed_out: {
        title: "Someone backed out of their spot.",
        body: (d) => d.claimer_name
            ? `${d.claimer_name} backed out of their approved claim${d.post_summary ? ` on ${d.post_summary}` : ""}. The spot is now open again.`
            : "A player backed out of their claim on your post. The spot is now open again.",
        subject: (d) => d.claimer_name
            ? `${d.claimer_name} backed out of your CourtPlay post`
            : "A claimer backed out of your CourtPlay post",
        deepLink: () => "https://courtplay.app/activity",
    },
    cost_changed: {
        title: "Cost updated on a post you claimed.",
        body: (d) => {
            let msg = "The cost on a post you claimed changed";
            if (d.old_cost && d.new_cost) msg = `Cost changed from $${d.old_cost} to $${d.new_cost}`;
            if (d.post_summary) msg += ` — ${d.post_summary}`;
            msg += ". You can back out if the new price doesn't work for you.";
            return msg;
        },
        subject: (d) => d.old_cost && d.new_cost
            ? `CourtPlay cost changed: $${d.old_cost} → $${d.new_cost}`
            : "Cost updated on your CourtPlay claim",
        deepLink: (postId) => postId ? `https://courtplay.app/post/${postId}` : "https://courtplay.app/activity",
    },
    nudge_no_response: {
        title: "Reminder that you have pending claims waiting.",
        body: (d) => d.post_summary
            ? `You have claims waiting for your response on ${d.post_summary}. Review them now.`
            : "You have claims waiting for your response. Review them now.",
        subject: () => "Pending claims on your CourtPlay post",
        deepLink: () => "https://courtplay.app/activity",
    },
    claimer_cancelled: {
        title: "Someone cancelled their claim.",
        body: (d) => d.claimer_name
            ? `${d.claimer_name} cancelled their pending claim${d.post_summary ? ` on ${d.post_summary}` : ""}.`
            : "A player cancelled their pending claim on your post.",
        subject: (d) => d.claimer_name
            ? `${d.claimer_name} cancelled their CourtPlay claim`
            : "A claimer cancelled their CourtPlay claim",
        deepLink: () => "https://courtplay.app/activity",
    },
    price_drop: {
        title: "Price drop!",
        body: (d) => {
            let msg = "A post you viewed just dropped its price";
            if (d.old_cost && d.new_cost) msg = `Price dropped from $${d.old_cost} to $${d.new_cost}`;
            if (d.post_summary) msg += ` — ${d.post_summary}`;
            msg += ". Check it out!";
            return msg;
        },
        subject: () => "Price drop on a CourtPlay post",
        deepLink: (postId) => postId ? `https://courtplay.app/post/${postId}` : "https://courtplay.app/feed",
    },
    spot_reopened: {
        title: "Spot reopened!",
        body: (d) => d.post_summary
            ? `A spot you were watching at ${d.post_summary} has opened up. Claim it before someone else does!`
            : "A spot you were watching has opened up. Claim it before someone else does!",
        subject: () => "A CourtPlay spot just opened up",
        deepLink: (postId) => postId ? `https://courtplay.app/post/${postId}` : "https://courtplay.app/feed",
    },
    "48h_unfilled": {
        title: "Your post is still open.",
        body: (d) => d.post_summary
            ? `Your post for ${d.post_summary} has been up for 48 hours with no claims. Consider lowering the price to attract interest.`
            : "Your post has been up for 48 hours with no claims. Consider lowering the price to attract interest.",
        subject: () => "Your CourtPlay post still needs a sub",
        deepLink: (postId) => postId ? `https://courtplay.app/post/${postId}` : "https://courtplay.app/activity",
    },
    game_reminder: {
        title: "Game tomorrow!",
        body: (d) => {
            let msg = "You have a game tomorrow";
            if (d.game_time) msg += ` at ${d.game_time}`;
            if (d.location) msg += ` — ${d.location}`;
            msg += ". Don't forget!";
            return msg;
        },
        subject: () => "Reminder: CourtPlay game tomorrow",
        deepLink: (postId) => postId ? `https://courtplay.app/post/${postId}` : "https://courtplay.app/activity",
    },
    friend_expiry: {
        title: "Your friend's game still has an open spot!",
        body: (d) => {
            if (d.poster_name && d.location) {
                return `${d.poster_name}'s spot at ${d.location} is still open \u2014 game starts in 4 hours.`;
            }
            return "A friend's game is happening soon and still has open spots.";
        },
        subject: (d) => d.poster_name
            ? `${d.poster_name}'s CourtPlay game needs players`
            : "A friend's CourtPlay game needs players",
        deepLink: (postId) => postId ? `https://courtplay.app/post/${postId}` : "https://courtplay.app/feed",
    },
    friend_new_post: {
        title: "Your friend posted an open spot!",
        body: (d) => d.poster_name
            ? `${d.poster_name} just posted a new sub need${d.post_summary ? ` — ${d.post_summary}` : ""}. Check it out!`
            : "A friend just posted a new sub need. Check it out!",
        subject: (d) => d.poster_name
            ? `${d.poster_name} needs a sub on CourtPlay`
            : "A friend needs a sub on CourtPlay",
        deepLink: (postId) => postId ? `https://courtplay.app/post/${postId}` : "https://courtplay.app/feed",
    },
    connection_request: {
        title: "Someone wants to connect!",
        body: (d) => d.claimer_name
            ? `${d.claimer_name} reached out about your regular play post. Open the conversation to reply.`
            : "Someone reached out about your regular play post. Open the conversation to reply.",
        subject: (d) => d.claimer_name
            ? `${d.claimer_name} wants to connect on CourtPlay`
            : "Someone wants to connect on CourtPlay",
        deepLink: () => "https://courtplay.app/activity?tab=created",
    },
    connection_closed: {
        title: "A group filled up",
        body: (d) => d.poster_name
            ? `${d.poster_name} found a spot, so their regular play post is now closed.`
            : "The player found a spot, so their regular play post is now closed.",
        subject: (d) => d.poster_name
            ? `${d.poster_name} found a spot on CourtPlay`
            : "A CourtPlay player found a spot",
        deepLink: () => "https://courtplay.app/activity",
    },
    feedback_submitted: {
        title: "New feedback submitted",
        body: (d) => {
            const who = d.submitter_name ? `${d.submitter_name} submitted feedback` : "A player submitted feedback";
            return d.feedback_title ? `${who}: "${d.feedback_title}". Review it in the admin dashboard.` : `${who}. Review it in the admin dashboard.`;
        },
        subject: (d) => d.feedback_title ? `New CourtPlay feedback: ${d.feedback_title}` : "New CourtPlay feedback submitted",
        deepLink: () => "https://courtplay.app/admin",
    },
};

// Default channels per notification type
const DEFAULT_CHANNELS: Record<NotificationType, { push: boolean; email: boolean }> = {
    // Claim lifecycle (claimed / approved / declined) pushes by default.
    claim_submitted:    { push: true, email: true },
    claim_approved:     { push: true, email: true },
    claim_rejected:     { push: true, email: true },
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
    feedback_submitted: { push: true, email: true },   // N16 — admin-only
};

function buildEmailHtml(template: TemplateConfig, d: Record<string, string>, postId?: string, venmoLink?: string): string {
    const ctaUrl = template.deepLink(postId);
    const venmoSection = venmoLink
        ? `<p style="margin: 12px 0 0;"><a href="${venmoLink}" style="display: inline-block; background: #008CFF; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Pay via Venmo</a></p>`
        : "";

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1B1B1B; font-size: 18px; margin: 0 0 12px;">${template.title}</h2>
            <p style="color: #6B7280; font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${template.body(d)}</p>
            ${venmoSection}
            <a href="${ctaUrl}"
               style="display: inline-block; background: #2D6A4F; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                View on CourtPlay
            </a>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0 16px;" />
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                CourtPlay — Find a tennis sub in Westport<br />
                <a href="https://courtplay.app/profile/edit" style="color: #9CA3AF; text-decoration: underline;">Manage notification preferences</a>
            </p>
        </div>
    `;
}

const json = corsJson;

/**
 * OneSignal changed its REST auth scheme: keys minted for the current API expect
 * `Authorization: Key <key>`, while older ones only accept the legacy
 * `Basic <key>`. Which one a given app needs isn't discoverable from the key
 * itself, and getting it wrong is a flat 401, so try the current scheme first and
 * fall back once. The winner is cached for the life of the isolate.
 */
let authScheme: "Key" | "Basic" | null = null;

async function postToOneSignal(scheme: "Key" | "Basic", payload: unknown) {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            Authorization: `${scheme} ${ONESIGNAL_REST_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = text;
    }
    return { ok: res.ok, status: res.status, body: parsed };
}

/**
 * POSTs one notification to OneSignal and returns the parsed response body
 * alongside the status. The body is what distinguishes a real delivery from
 * `{"recipients": 0}` — both of which come back as HTTP 200.
 */
async function sendPush(userId: string, title: string, body: string, url: string) {
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        // Target the *user*, not a device. The client aliases each subscription to
        // the app's user id via OneSignal.login(), so this follows the person
        // across devices and can't deliver to whoever signed in most recently.
        include_aliases: { external_id: [userId] },
        target_channel: "push",
        headings: { en: title },
        contents: { en: body },
        url,
    };

    const order: Array<"Key" | "Basic"> = authScheme ? [authScheme] : ["Key", "Basic"];
    let last = await postToOneSignal(order[0], payload);
    if (last.ok) {
        authScheme = order[0];
        return { ...last, scheme: order[0] };
    }

    // Only an auth rejection is worth retrying — anything else is a real error.
    if (order.length > 1 && last.status === 401) {
        const retry = await postToOneSignal(order[1], payload);
        if (retry.ok) authScheme = order[1];
        return { ...retry, scheme: order[1] };
    }

    return { ...last, scheme: order[0] };
}

serve(async (req) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Validate Authorization — only service role key allowed
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
        // Also allow calls from other Edge Functions (internal calls via supabase.functions.invoke)
        // which include the service role key automatically
        if (!authHeader) {
            return json({ error: "Unauthorized" }, 401);
        }
    }

    const { user_id, notification_type, post_id, claim_id, data: extraData, test } = await req.json();

    if (!user_id || !notification_type) {
        return json({ error: "Missing user_id or notification_type" }, 400);
    }

    const template = TEMPLATES[notification_type as NotificationType];
    if (!template) {
        return json({ error: "Unknown notification type" }, 400);
    }

    // Test mode: prove the server → OneSignal → device leg works, and nothing else.
    // Skips preferences, email, and the notifications row so it leaves no trace.
    // Only ever allowed against yourself, so the on-device debug button can't be
    // repurposed to push at other users.
    if (test) {
        const { data: caller } = await supabase.auth.getUser(token);
        if (!caller?.user || caller.user.id !== user_id) {
            return json({ error: "Test mode is only allowed against your own user", fnBuild: FN_BUILD }, 403);
        }

        if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
            return json({
                test: true,
                fnBuild: FN_BUILD,
                sent: false,
                reason: "OneSignal env vars missing on the function",
                appIdSet: Boolean(ONESIGNAL_APP_ID),
                restKeySet: Boolean(ONESIGNAL_REST_API_KEY),
            });
        }

        const result = await sendPush(
            user_id,
            "CourtPlay test push",
            "If you can read this, server-sent push is working.",
            "https://courtplay.app/profile",
        );
        return json({
            test: true,
            fnBuild: FN_BUILD,
            sent: result.ok,
            externalId: user_id,
            scheme: result.scheme,
            status: result.status,
            onesignal: result.body,
        });
    }

    // Look up user preferences
    const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("push_enabled, email_enabled")
        .eq("user_id", user_id)
        .eq("notification_type", notification_type)
        .maybeSingle();

    const defaults = DEFAULT_CHANNELS[notification_type as NotificationType] ?? { push: false, email: true };
    const pushEnabled = prefs?.push_enabled ?? defaults.push;
    const emailEnabled = prefs?.email_enabled ?? defaults.email;

    // If both channels disabled, skip
    if (!pushEnabled && !emailEnabled) {
        return json({ success: true, skipped: true });
    }

    // Get user info for email/push
    const { data: userRow } = await supabase
        .from("users")
        .select("email")
        .eq("id", user_id)
        .single();

    if (!userRow) {
        return json({ error: "User not found" }, 404);
    }

    const d: Record<string, string> = extraData ?? {};
    const results: Record<string, unknown> = {};
    let pushSent = false;
    let emailSent = false;

    // Send push via OneSignal
    if (pushEnabled && ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
        try {
            const pushRes = await sendPush(
                user_id,
                template.title,
                template.body(d),
                template.deepLink(post_id),
            );
            results.push = { status: pushRes.status, scheme: pushRes.scheme, onesignal: pushRes.body };
            pushSent = pushRes.ok;

            if (pushRes.ok) {
                await supabase.from("notifications").insert({
                    user_id,
                    type: notification_type,
                    post_id: post_id ?? null,
                    claim_id: claim_id ?? null,
                    channel: "push",
                });
            }
        } catch (e) {
            results.push = { error: String(e) };
            // Push failed — don't block email
        }
    }

    // Fallback: if push enabled but no player ID, fall back to email
    // With external-id targeting there is no stored id to pre-check, so fall back
    // on an actual delivery failure rather than on a missing column.
    const shouldFallbackToEmail = pushEnabled && !pushSent && !emailEnabled;

    // Send email via send-email function
    if ((emailEnabled || shouldFallbackToEmail) && userRow.email) {
        try {
            const venmoLink = notification_type === "claim_approved" && d.venmo_handle
                ? `https://venmo.com/${d.venmo_handle}`
                : undefined;
            const emailHtml = buildEmailHtml(template, d, post_id, venmoLink);

            await supabase.functions.invoke("send-email", {
                body: {
                    to: userRow.email,
                    subject: template.subject(d),
                    html: emailHtml,
                },
            });

            await supabase.from("notifications").insert({
                user_id,
                type: notification_type,
                post_id: post_id ?? null,
                claim_id: claim_id ?? null,
                channel: "email",
            });

            emailSent = true;
            results.email = { sent: true };
        } catch (e) {
            results.email = { error: String(e) };
        }
    }

    return json({ success: true, pushSent, emailSent, results });
});
