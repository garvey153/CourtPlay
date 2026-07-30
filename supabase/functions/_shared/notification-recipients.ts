/**
 * Pure recipient-list rules, kept free of Deno and Supabase imports so they can
 * be unit-tested from the app's vitest suite.
 *
 * The rules themselves used to live in the browser, where each trigger site
 * built its own recipient array before handing it to the edge function. Moving
 * them server-side is what closes the hole, but the "don't notify the actor",
 * "don't tell the same person twice" and "don't double-notify a live claimer"
 * decisions are ordinary list logic and shouldn't need a database to verify.
 */

/**
 * Distinct ids with the actor removed.
 *
 * Nobody should be notified about something they just did themselves, and a
 * user who is both (say) a watcher and a follower should still hear once.
 */
export function others(ids: Array<string | null | undefined>, actorId: string): string[] {
    return [...new Set(ids.filter((id): id is string => Boolean(id) && id !== actorId))];
}

/**
 * Removes ids that are already receiving a more specific notification.
 *
 * A price drop goes to prior viewers, but anyone holding a live claim gets the
 * cost-changed notice instead — without this they'd get both for one edit.
 */
export function excluding(ids: string[], exclude: Iterable<string>): string[] {
    const skip = new Set(exclude);
    return ids.filter((id) => !skip.has(id));
}
