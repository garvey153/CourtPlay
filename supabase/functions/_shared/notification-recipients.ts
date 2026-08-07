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

/**
 * Who hears that a post went up.
 *
 * The two cases point in OPPOSITE directions along `follows`, which is the
 * whole reason this is a named function rather than a filter at the call site:
 *
 *   public  → the poster's FOLLOWERS. You followed someone, so you hear when
 *             they post. Their own following list is irrelevant.
 *   private → the AUDIENCE, and nothing else: the people the POSTER FOLLOWS
 *             (when "All players followed" is ticked) plus every member of a
 *             picked group. A follower who is not in the audience must not
 *             hear — that is the leak this closes — and a group member who
 *             does not follow the poster must, which no filter over followers
 *             could ever produce.
 *
 * Deriving the private list from `followers` is the mistake to avoid: it looks
 * right, it notifies plausible people, and it is wrong in both directions.
 */
/**
 * Who hears about a post because they're playing in the game it belongs to.
 *
 * The tagged group is the people already in the game — a different set from the
 * audience, who are candidates to fill the spot. Both the poster and whoever
 * claimed the spot are dropped: the poster caused the event, and the claimer is
 * getting the specific claim notification instead.
 */
export function taggedRecipients(args: {
    /** Members of the post's tagged group, removals already filtered out. */
    groupMembers: string[];
    posterId: string;
    /** The claimer, when the event is a claim or an approval. */
    claimerId?: string | null;
}): string[] {
    const { groupMembers, posterId, claimerId } = args;
    return excluding(others(groupMembers, posterId), claimerId ? [claimerId] : []);
}

export function newPostRecipients(args: {
    isPrivate: boolean;
    /** Users who follow the poster. */
    followers: string[];
    /** Users the poster follows — only consulted when allFollowing is set. */
    following: string[];
    allFollowing: boolean;
    /** Members of every group on the post's audience. */
    groupMembers: string[];
    /** Members of the post's TAGGED group, who get their own notification instead. */
    taggedMembers?: string[];
    posterId: string;
}): string[] {
    const { isPrivate, followers, following, allFollowing, groupMembers, taggedMembers = [], posterId } = args;
    // Group membership wins over following: someone in the tagged group is
    // hearing about this post already, for a more specific reason. Applies to
    // public posts too — a follower who is also playing in the game would
    // otherwise get two notifications for one post.
    const base = isPrivate
        ? others([...(allFollowing ? following : []), ...groupMembers], posterId)
        : others(followers, posterId);
    return excluding(base, taggedMembers);
}
