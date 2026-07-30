/**
 * "Have we already told this person about this?" for the scheduled jobs.
 *
 * All four asked it the same way and all four got it wrong the same way:
 *
 *     .eq("user_id", …).eq("type", …).eq("post_id", …).maybeSingle()
 *
 * `maybeSingle()` returns an error when it matches more than one row, and
 * send-notification inserts one `notifications` row *per channel* — so a
 * recipient who received both push and email has two. The query then errors,
 * `data` comes back null, the caller reads that as "not sent yet", and re-sends.
 * Every run. Forever.
 *
 * These types all default to email-only, so the second row only appears for
 * someone who turned push on in their preferences. Opting into push therefore
 * disabled dedupe for that user alone, which is about the worst way for a bug
 * like this to present.
 *
 * `limit(1)` on an array result is correct for any row count, which is what this
 * wants: existence, not cardinality.
 */

// deno-lint-ignore no-explicit-any
type Supabase = any;

export interface DedupeKey {
    userId: string;
    type: string;
    /** Post-anchored jobs (game reminders, unfilled nudge, friend expiry). */
    postId?: string;
    /** Claim-anchored jobs (unresponded-claim nudge). */
    claimId?: string;
}

/**
 * True if this recipient already has a notification row for this type on this
 * post/claim. Errors resolve to `false` — a failed lookup should let the send
 * through rather than silently suppress it, since a duplicate notification is a
 * smaller harm than one that never arrives.
 */
export async function alreadyNotified(supabase: Supabase, key: DedupeKey): Promise<boolean> {
    let query = supabase
        .from("notifications")
        .select("id")
        .eq("user_id", key.userId)
        .eq("type", key.type);

    if (key.postId) query = query.eq("post_id", key.postId);
    if (key.claimId) query = query.eq("claim_id", key.claimId);

    const { data, error } = await query.limit(1);

    if (error) return false;
    return Array.isArray(data) && data.length > 0;
}
