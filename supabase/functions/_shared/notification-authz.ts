/**
 * Authorization and payload derivation for notifications requested by a user.
 *
 * The client used to hand `send-notification` a recipient, a type, and a fully
 * formed `data` blob, and the function sent whatever it was told. Since the
 * anon key ships in the JS bundle, that let anyone push and email any user with
 * arbitrary copy, from a domain-verified sender, with a "View on CourtPlay" CTA
 * on it — a usable phishing primitive rather than a theoretical one.
 *
 * So the client no longer says *who* to notify or *what* to say. It names a
 * type and points at a row it already has a relationship to. Everything else is
 * read back out of the database here: this module checks that the caller is
 * actually entitled to trigger that notification on that row, then derives the
 * recipients and the template data from the row itself.
 *
 * Trusted callers (service role — the scheduled jobs and notify-feedback) skip
 * all of this and keep passing explicit payloads; they aren't the threat.
 */

import { excluding, others } from "./notification-recipients.ts";

// deno-lint-ignore no-explicit-any
type Supabase = any;

export interface ResolvedNotification {
    recipients: string[];
    data: Record<string, string>;
    post_id: string | null;
    claim_id: string | null;
}

export type Resolution =
    | { ok: true; value: ResolvedNotification }
    | { ok: false; status: number; error: string };

/** Types a user may trigger. Anything absent is service-role only. */
const USER_TRIGGERABLE = new Set([
    "claim_submitted",
    "connection_request",
    "claimer_backed_out",
    "claim_approved",
    "claim_rejected",
    "claimer_cancelled",
    "spot_reopened",
    "connection_closed",
    "friend_new_post",
    "cost_changed",
    "price_drop",
]);

const deny = (status: number, error: string): Resolution => ({ ok: false, status, error });

function postSummary(post: { location?: string | null; custom_court?: string | null }): string {
    return post.location ?? post.custom_court ?? "";
}

async function firstName(supabase: Supabase, userId: string): Promise<string> {
    const { data } = await supabase.from("users").select("first_name").eq("id", userId).single();
    return data?.first_name ?? "";
}

export async function resolveUserNotification(
    supabase: Supabase,
    callerId: string,
    input: {
        notification_type: string;
        post_id?: string | null;
        claim_id?: string | null;
        // Display-only values the server cannot recover after the fact. See the
        // note on the cost cases below.
        old_cost?: string | null;
    },
): Promise<Resolution> {
    const type = input.notification_type;

    if (!USER_TRIGGERABLE.has(type)) {
        return deny(403, `${type} cannot be triggered by a user`);
    }

    // ── Claim-anchored types ────────────────────────────────────────────────
    const claimAnchored = [
        "claim_submitted",
        "connection_request",
        "claimer_backed_out",
        "claim_approved",
        "claim_rejected",
        "claimer_cancelled",
    ];

    if (claimAnchored.includes(type)) {
        if (!input.claim_id) return deny(400, `${type} requires claim_id`);

        const { data: claim } = await supabase
            .from("claims")
            .select("id, post_id, claimer_id, rejection_reason, posts:post_id(author_id, location, custom_court)")
            .eq("id", input.claim_id)
            .single();

        if (!claim) return deny(404, "Claim not found");

        const post = claim.posts as { author_id: string; location: string | null; custom_court: string | null } | null;
        if (!post) return deny(404, "Post not found for claim");

        const summary = postSummary(post);
        const base = { post_id: claim.post_id as string, claim_id: claim.id as string };

        switch (type) {
            // Actions taken by the claimer, reported to the poster.
            case "claim_submitted":
            case "connection_request":
            case "claimer_backed_out": {
                if (claim.claimer_id !== callerId) return deny(403, "Only the claimer may trigger this");
                const claimer_name = await firstName(supabase, callerId);
                const data: Record<string, string> = type === "connection_request"
                    ? { claimer_name }
                    : { claimer_name, post_summary: summary };
                return { ok: true, value: { recipients: [post.author_id], data, ...base } };
            }

            // Actions taken by the poster, reported to the claimer.
            case "claim_approved": {
                if (post.author_id !== callerId) return deny(403, "Only the post author may trigger this");
                const poster_name = await firstName(supabase, callerId);
                return {
                    ok: true,
                    value: { recipients: [claim.claimer_id], data: { poster_name, post_summary: summary }, ...base },
                };
            }
            case "claim_rejected": {
                if (post.author_id !== callerId) return deny(403, "Only the post author may trigger this");
                // The reason is read back off the claim rather than taken from the
                // caller, so the copy in the email matches what was actually recorded.
                return {
                    ok: true,
                    value: {
                        recipients: [claim.claimer_id],
                        data: { post_summary: summary, reason: claim.rejection_reason ?? "" },
                        ...base,
                    },
                };
            }

            // Admin-initiated: both sides of the claim hear about it.
            case "claimer_cancelled": {
                const { data: caller } = await supabase
                    .from("users")
                    .select("is_admin")
                    .eq("id", callerId)
                    .single();
                if (!caller?.is_admin) return deny(403, "Admin only");
                const claimer_name = await firstName(supabase, claim.claimer_id);
                return {
                    ok: true,
                    value: {
                        recipients: others([claim.claimer_id, post.author_id], callerId),
                        data: { claimer_name, post_summary: summary },
                        ...base,
                    },
                };
            }
        }
    }

    // ── Post-anchored types ─────────────────────────────────────────────────
    if (!input.post_id) return deny(400, `${type} requires post_id`);

    const { data: post } = await supabase
        .from("posts")
        .select("id, author_id, location, custom_court, cost")
        .eq("id", input.post_id)
        .single();

    if (!post) return deny(404, "Post not found");

    // Every post-anchored type is something only the post's author can cause.
    if (post.author_id !== callerId) return deny(403, "Only the post author may trigger this");

    const summary = postSummary(post);
    const base = { post_id: post.id as string, claim_id: null };

    /** Claimers currently attached to the post, by status. */
    async function claimerIds(statuses: string[]): Promise<string[]> {
        const { data } = await supabase
            .from("claims")
            .select("claimer_id")
            .eq("post_id", post.id)
            .in("status", statuses);
        return others((data ?? []).map((c: { claimer_id: string }) => c.claimer_id), callerId);
    }

    switch (type) {
        case "spot_reopened": {
            const { data: watchers } = await supabase
                .from("notify_me")
                .select("user_id")
                .eq("post_id", post.id);
            return {
                ok: true,
                value: {
                    recipients: others((watchers ?? []).map((w: { user_id: string }) => w.user_id), callerId),
                    data: { post_summary: summary },
                    ...base,
                },
            };
        }

        case "connection_closed": {
            const poster_name = await firstName(supabase, callerId);
            return {
                ok: true,
                value: {
                    recipients: await claimerIds(["pending", "approved"]),
                    data: { poster_name },
                    ...base,
                },
            };
        }

        case "friend_new_post": {
            const { data: followers } = await supabase
                .from("follows")
                .select("follower_id")
                .eq("following_id", callerId);
            const poster_name = await firstName(supabase, callerId);
            return {
                ok: true,
                value: {
                    recipients: others((followers ?? []).map((f: { follower_id: string }) => f.follower_id), callerId),
                    data: { poster_name, post_summary: summary },
                    ...base,
                },
            };
        }

        // The two cost cases are the one place a caller-supplied value survives.
        // `new_cost` is read from the post, but the *previous* price is genuinely
        // unrecoverable here: the edit writes `posts.cost` in place and never
        // touches `original_cost`, so by the time this runs the old value is
        // gone. It is display-only, and the caller is already proven to be the
        // author of the post whose price it describes — so the blast radius is
        // "a poster can misstate their own old price", not "anyone can message
        // anyone". Recipients and entitlement are still fully derived.
        case "cost_changed":
        case "price_drop": {
            const newCost = post.cost != null ? Number(post.cost).toFixed(2) : "";
            const data: Record<string, string> = { new_cost: newCost, post_summary: summary };
            if (input.old_cost) data.old_cost = String(input.old_cost);

            if (type === "cost_changed") {
                return { ok: true, value: { recipients: await claimerIds(["pending", "approved"]), data, ...base } };
            }

            // Prior viewers, excluding anyone already holding a live claim —
            // they get the cost_changed notice instead and shouldn't get both.
            const active = await claimerIds(["pending", "approved"]);
            const { data: viewers } = await supabase
                .from("post_views")
                .select("user_id")
                .eq("post_id", post.id);
            const recipients = excluding(
                others((viewers ?? []).map((v: { user_id: string }) => v.user_id), callerId),
                active,
            );

            return { ok: true, value: { recipients, data, ...base } };
        }
    }

    return deny(400, `Unhandled notification type: ${type}`);
}
