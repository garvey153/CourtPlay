import { describe, expect, it } from "vitest";
import { resolveUserNotification } from "../../supabase/functions/_shared/notification-authz.ts";

/**
 * The resolver, exercised against a fake database.
 *
 * notification-recipients.test.ts covers the recipient RULES as pure functions.
 * This file covers the WIRING around them, which is where the mistakes that
 * matter actually live: which table each set is read from, which way round the
 * `follows` columns go, and whether the dedupe is applied at all. A rule can be
 * perfectly correct and still be fed the wrong list.
 *
 * The fake records what was asked for and answers from a fixture, so a test can
 * assert on the query as well as the result — `followsQueries` below is what
 * catches a reversed lookup even when the recipient list happens to look right.
 */

interface World {
    post?: Record<string, unknown>;
    /** follower_id -> following_id pairs. */
    follows?: Array<{ follower_id: string; following_id: string }>;
    audienceGroupIds?: string[];
    /** group id -> member ids (removed members already excluded). */
    groupMembers?: Record<string, string[]>;
    groups?: Record<string, { name: string; deleted_at: string | null }>;
    claims?: Array<{ id: string; post_id: string; claimer_id: string; status: string }>;
}

/** Every follows lookup the resolver made, so the direction can be asserted. */
type FollowsQuery = { following_id?: string; follower_id?: string };

function fakeSupabase(world: World, followsQueries: FollowsQuery[]) {
    return {
        from(table: string) {
            const f: Record<string, unknown> = {};
            const answer = () => {
                switch (table) {
                    case "posts":
                        return world.post ?? null;
                    case "users":
                        return { first_name: `name-of-${f.id}` };
                    case "follows": {
                        followsQueries.push({ ...f } as FollowsQuery);
                        const rows = world.follows ?? [];
                        // Mirrors PostgREST: whichever column was filtered on.
                        if (f.following_id) {
                            return rows.filter((r) => r.following_id === f.following_id)
                                .map((r) => ({ follower_id: r.follower_id }));
                        }
                        return rows.filter((r) => r.follower_id === f.follower_id)
                            .map((r) => ({ following_id: r.following_id }));
                    }
                    case "post_audience_groups":
                        return (world.audienceGroupIds ?? []).map((group_id) => ({ group_id }));
                    case "group_members": {
                        const ids = Array.isArray(f.group_id) ? (f.group_id as string[]) : [f.group_id as string];
                        return ids.flatMap((id) => (world.groupMembers?.[id] ?? []).map((user_id) => ({ user_id })));
                    }
                    case "groups":
                        return world.groups?.[f.id as string] ?? null;
                    case "claims": {
                        let rows = (world.claims ?? []).filter((c) => c.post_id === f.post_id);
                        if (f.claimer_id) rows = rows.filter((c) => c.claimer_id === f.claimer_id);
                        if (Array.isArray(f.status)) rows = rows.filter((c) => (f.status as string[]).includes(c.status));
                        return rows;
                    }
                    default:
                        return [];
                }
            };
            const one = () => {
                const a = answer();
                return Promise.resolve({ data: Array.isArray(a) ? (a[0] ?? null) : a, error: null });
            };
            const builder: Record<string, unknown> = {
                select: () => builder,
                eq: (c: string, v: unknown) => { f[c] = v; return builder; },
                in: (c: string, v: unknown) => { f[c] = v; return builder; },
                is: () => builder,
                order: () => builder,
                limit: () => builder,
                single: one,
                maybeSingle: one,
                // Awaiting the chain without a terminal returns the list form.
                then: (resolve: (r: unknown) => void) => {
                    const a = answer();
                    resolve({ data: Array.isArray(a) ? a : [a], error: null });
                },
            };
            return builder;
        },
    };
}

const POST = "post-1";
const POSTER = "poster";

/** A public, untagged post by POSTER. */
const publicPost = {
    id: POST, author_id: POSTER, location: "Longshore", custom_court: null, cost: 25,
    visibility: "public", audience_all_following: false, tagged_group_id: null,
};

async function resolve(world: World, callerId: string, type: string, extra: Record<string, unknown> = {}) {
    const followsQueries: FollowsQuery[] = [];
    const supabase = fakeSupabase(world, followsQueries);
    const res = await resolveUserNotification(supabase, callerId, {
        notification_type: type,
        post_id: POST,
        ...extra,
    });
    return { res, followsQueries };
}

describe("friend_new_post — who hears about a new post", () => {
    it("public: the poster's FOLLOWERS, and it queries follows by following_id", async () => {
        const { res, followsQueries } = await resolve(
            { post: publicPost, follows: [{ follower_id: "fan", following_id: POSTER }] },
            POSTER,
            "friend_new_post",
        );
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value.recipients).toEqual(["fan"]);
        // The direction assertion: followers are found by following_id = poster.
        expect(followsQueries).toContainEqual({ following_id: POSTER });
    });

    it("private + all-following: people the POSTER FOLLOWS, queried by follower_id", async () => {
        const { res, followsQueries } = await resolve(
            {
                post: { ...publicPost, visibility: "private", audience_all_following: true },
                follows: [
                    { follower_id: POSTER, following_id: "followed-by-poster" },
                    { follower_id: "fan", following_id: POSTER },
                ],
            },
            POSTER,
            "friend_new_post",
        );
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.value.recipients).toEqual(["followed-by-poster"]);
            // The bug this guards: a follower who is not followed back must NOT hear.
            expect(res.value.recipients).not.toContain("fan");
        }
        expect(followsQueries).toContainEqual({ follower_id: POSTER });
    });

    it("private: audience group members hear even though they don't follow the poster", async () => {
        const { res } = await resolve(
            {
                post: { ...publicPost, visibility: "private", audience_all_following: false },
                audienceGroupIds: ["aud"],
                groupMembers: { aud: [POSTER, "aud-member"] },
            },
            POSTER,
            "friend_new_post",
        );
        if (res.ok) expect(res.value.recipients).toEqual(["aud-member"]);
    });
});

describe("the tagged group", () => {
    const taggedWorld: World = {
        post: { ...publicPost, tagged_group_id: "tag" },
        groups: { tag: { name: "The Racquettes", deleted_at: null } },
        groupMembers: { tag: [POSTER, "playing-1", "playing-2"] },
    };

    it("tagged_post_created: the group, minus the poster, with the group name attached", async () => {
        const { res } = await resolve(taggedWorld, POSTER, "tagged_post_created");
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.value.recipients.sort()).toEqual(["playing-1", "playing-2"]);
            expect(res.value.data.group_name).toBe("The Racquettes");
        }
    });

    it("tagged_post_claimed: triggered by the CLAIMER, who is then dropped from the list", async () => {
        const world: World = {
            ...taggedWorld,
            groupMembers: { tag: [POSTER, "playing-1", "claimer"] },
            claims: [{ id: "c1", post_id: POST, claimer_id: "claimer", status: "pending" }],
        };
        const { res } = await resolve(world, "claimer", "tagged_post_claimed");
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.value.recipients).toEqual(["playing-1"]);
            expect(res.value.recipients).not.toContain("claimer");
            // The poster is excluded even though they aren't the caller here —
            // this is the event where caller and author differ, so anything
            // derived from callerId instead of post.author_id shows up.
            expect(res.value.recipients).not.toContain(POSTER);
            expect(res.value.data.poster_name).toBe(`name-of-${POSTER}`);
            expect(res.value.data.claimer_name).toBe("name-of-claimer");
        }
    });

    it("tagged_claim_approved: triggered by the author, still drops the claimer", async () => {
        const world: World = {
            ...taggedWorld,
            groupMembers: { tag: [POSTER, "playing-1", "claimer"] },
            claims: [{ id: "c1", post_id: POST, claimer_id: "claimer", status: "approved" }],
        };
        const { res } = await resolve(world, POSTER, "tagged_claim_approved");
        if (res.ok) expect(res.value.recipients).toEqual(["playing-1"]);
    });

    it("no tag on the post: no recipients, and NOT an error", async () => {
        const { res } = await resolve({ post: publicPost }, POSTER, "tagged_post_created");
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value.recipients).toEqual([]);
    });

    it("a deleted tagged group notifies nobody", async () => {
        const { res } = await resolve(
            { ...taggedWorld, groups: { tag: { name: "Gone", deleted_at: "2026-08-01T00:00:00Z" } } },
            POSTER,
            "tagged_post_created",
        );
        if (res.ok) expect(res.value.recipients).toEqual([]);
    });

    it("someone who is neither author nor claimer cannot trigger a tagged notification", async () => {
        const { res } = await resolve(taggedWorld, "outsider", "tagged_post_created");
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.status).toBe(403);
    });
});

describe("overlap — one post, one notification per person", () => {
    it("in the audience group AND followed: heard once, from one type", async () => {
        const { res } = await resolve(
            {
                post: { ...publicPost, visibility: "private", audience_all_following: true },
                follows: [{ follower_id: POSTER, following_id: "both" }],
                audienceGroupIds: ["aud"],
                groupMembers: { aud: ["both"] },
            },
            POSTER,
            "friend_new_post",
        );
        if (res.ok) expect(res.value.recipients).toEqual(["both"]);
    });

    it("in the TAGGED group AND followed: friend_new_post skips them, the tagged one keeps them", async () => {
        const world: World = {
            post: { ...publicPost, tagged_group_id: "tag" },
            follows: [
                { follower_id: "playing-and-following", following_id: POSTER },
                { follower_id: "just-following", following_id: POSTER },
            ],
            groups: { tag: { name: "The Racquettes", deleted_at: null } },
            groupMembers: { tag: [POSTER, "playing-and-following"] },
        };

        const { res: newPost } = await resolve(world, POSTER, "friend_new_post");
        if (newPost.ok) {
            expect(newPost.value.recipients).toEqual(["just-following"]);
            expect(newPost.value.recipients).not.toContain("playing-and-following");
        }

        const { res: tagged } = await resolve(world, POSTER, "tagged_post_created");
        if (tagged.ok) expect(tagged.value.recipients).toEqual(["playing-and-following"]);
    });

    it("in TWO audience groups: still one notification", async () => {
        // The group_members lookup returns a row per (group, user), so someone
        // in both groups comes back twice and has to be collapsed.
        const { res } = await resolve(
            {
                post: { ...publicPost, visibility: "private" },
                audienceGroupIds: ["aud-a", "aud-b"],
                groupMembers: { "aud-a": ["in-both", "only-a"], "aud-b": ["in-both", "only-b"] },
            },
            POSTER,
            "friend_new_post",
        );
        if (res.ok) {
            expect(res.value.recipients.filter((r) => r === "in-both")).toHaveLength(1);
            expect(res.value.recipients.sort()).toEqual(["in-both", "only-a", "only-b"]);
        }
    });

    it("in an audience group AND the tagged group: the tagged notification wins outright", async () => {
        const world: World = {
            post: { ...publicPost, visibility: "private", tagged_group_id: "tag" },
            audienceGroupIds: ["aud"],
            groups: { tag: { name: "The Racquettes", deleted_at: null } },
            groupMembers: { aud: ["audience-only", "in-both"], tag: [POSTER, "in-both"] },
        };

        const { res: newPost } = await resolve(world, POSTER, "friend_new_post");
        if (newPost.ok) {
            // Being in the audience does not earn a second notification.
            expect(newPost.value.recipients).toEqual(["audience-only"]);
            expect(newPost.value.recipients).not.toContain("in-both");
        }

        const { res: tagged } = await resolve(world, POSTER, "tagged_post_created");
        if (tagged.ok) expect(tagged.value.recipients).toEqual(["in-both"]);
    });

    it("the poster is never a recipient of their own post, by either route", async () => {
        const world: World = {
            post: { ...publicPost, tagged_group_id: "tag" },
            follows: [{ follower_id: POSTER, following_id: POSTER }],
            groups: { tag: { name: "G", deleted_at: null } },
            groupMembers: { tag: [POSTER] },
        };
        const { res: newPost } = await resolve(world, POSTER, "friend_new_post");
        if (newPost.ok) expect(newPost.value.recipients).toEqual([]);
        const { res: tagged } = await resolve(world, POSTER, "tagged_post_created");
        if (tagged.ok) expect(tagged.value.recipients).toEqual([]);
    });
});
