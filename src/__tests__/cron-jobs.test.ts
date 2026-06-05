import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers: pure-function simulations of the cron-job eligibility / filtering
// logic. These mirror what the Edge Functions do so we can unit-test the
// decision logic without running Deno.
// ---------------------------------------------------------------------------

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
const FOUR_HOURS = 4 * 60 * 60 * 1000;

/** nudge-unresponded-claims eligibility */
function isEligibleForNudge(claim: {
    status: string;
    created_at: string;
    post_status: string;
}) {
    if (claim.status !== "pending") return false;
    if (claim.post_status !== "active") return false;
    const age = Date.now() - new Date(claim.created_at).getTime();
    return age > TWELVE_HOURS;
}

/** 48h-unfilled-nudge eligibility */
function isEligibleFor48hNudge(post: {
    status: string;
    post_type: string;
    created_at: string;
    game_date: string;
    spots_total: number;
    approved_count: number;
}) {
    if (post.status !== "active") return false;
    if (post.post_type !== "sub_need") return false;
    const age = Date.now() - new Date(post.created_at).getTime();
    if (age <= FORTY_EIGHT_HOURS) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (post.game_date <= today) return false;
    if (post.approved_count >= post.spots_total) return false;
    return true;
}

/** game-reminders: determines if a post qualifies for a game reminder */
function isEligibleForGameReminder(post: {
    status: string;
    game_date: string;
}) {
    if (post.status !== "active") return false;
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    return post.game_date === tomorrowStr;
}

/** game-reminders: build the recipient list (poster + approved claimers only) */
function getGameReminderRecipients(
    posterId: string,
    claims: Array<{ claimer_id: string; status: string }>,
) {
    const ids = [posterId];
    for (const c of claims) {
        if (c.status === "approved") {
            ids.push(c.claimer_id);
        }
    }
    return ids;
}

/** friend-expiry-alerts: post eligibility */
function isEligibleForFriendExpiry(post: {
    status: string;
    post_type: string;
    game_datetime_ms: number;
    spots_total: number;
    approved_count: number;
}) {
    if (post.status !== "active") return false;
    if (post.post_type !== "sub_need") return false;
    if (post.approved_count >= post.spots_total) return false;
    // game must be within 4 hours from now
    const diff = post.game_datetime_ms - Date.now();
    return diff > 0 && diff <= FOUR_HOURS;
}

/** friend-expiry-alerts: filter follower list (exclude the poster) */
function filterFollowers(followers: string[], posterId: string) {
    return followers.filter((id) => id !== posterId);
}

/** auto-expire: should a post be expired? */
function shouldAutoExpire(post: {
    status: string;
    game_datetime_ms: number;
}) {
    if (post.status !== "active") return false;
    return post.game_datetime_ms < Date.now();
}

/** deduplication check — returns true if notification already exists */
function hasExistingNotification(
    notifications: Array<{ user_id: string; type: string; post_id: string; claim_id?: string }>,
    userId: string,
    type: string,
    postId: string,
    claimId?: string,
) {
    return notifications.some(
        (n) =>
            n.user_id === userId &&
            n.type === type &&
            n.post_id === postId &&
            (claimId === undefined || n.claim_id === claimId),
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("nudge-unresponded-claims", () => {
    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const elevenHoursAgo = new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString();

    it("finds claims pending > 12 hours", () => {
        expect(
            isEligibleForNudge({
                status: "pending",
                created_at: thirteenHoursAgo,
                post_status: "active",
            }),
        ).toBe(true);
    });

    it("does not nudge claims pending < 12 hours", () => {
        expect(
            isEligibleForNudge({
                status: "pending",
                created_at: elevenHoursAgo,
                post_status: "active",
            }),
        ).toBe(false);
    });

    it("does not nudge approved claims", () => {
        expect(
            isEligibleForNudge({
                status: "approved",
                created_at: thirteenHoursAgo,
                post_status: "active",
            }),
        ).toBe(false);
    });

    it("does not nudge rejected or unclaimed claims", () => {
        expect(
            isEligibleForNudge({
                status: "rejected",
                created_at: thirteenHoursAgo,
                post_status: "active",
            }),
        ).toBe(false);

        expect(
            isEligibleForNudge({
                status: "unclaimed",
                created_at: thirteenHoursAgo,
                post_status: "active",
            }),
        ).toBe(false);
    });

    it("deduplication — nudge sent only once per claim", () => {
        const notifications = [
            {
                user_id: "poster-1",
                type: "nudge_no_response",
                post_id: "post-1",
                claim_id: "claim-1",
            },
        ];

        // Already nudged for claim-1
        expect(
            hasExistingNotification(notifications, "poster-1", "nudge_no_response", "post-1", "claim-1"),
        ).toBe(true);

        // Not yet nudged for claim-2
        expect(
            hasExistingNotification(notifications, "poster-1", "nudge_no_response", "post-1", "claim-2"),
        ).toBe(false);
    });

    it("does not nudge claims on expired posts", () => {
        expect(
            isEligibleForNudge({
                status: "pending",
                created_at: thirteenHoursAgo,
                post_status: "expired",
            }),
        ).toBe(false);
    });
});

describe("48h-unfilled-nudge", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    it("finds active sub_need posts unfilled for 48h with game coming", () => {
        expect(
            isEligibleFor48hNudge({
                status: "active",
                post_type: "sub_need",
                created_at: threeDaysAgo,
                game_date: futureDate,
                spots_total: 2,
                approved_count: 0,
            }),
        ).toBe(true);
    });

    it("does not nudge posts with approved claims filling all spots", () => {
        expect(
            isEligibleFor48hNudge({
                status: "active",
                post_type: "sub_need",
                created_at: threeDaysAgo,
                game_date: futureDate,
                spots_total: 2,
                approved_count: 2,
            }),
        ).toBe(false);
    });

    it("does nudge posts with some spots still open", () => {
        expect(
            isEligibleFor48hNudge({
                status: "active",
                post_type: "sub_need",
                created_at: threeDaysAgo,
                game_date: futureDate,
                spots_total: 3,
                approved_count: 1,
            }),
        ).toBe(true);
    });

    it("deduplication — sent only once per post", () => {
        const notifications = [
            { user_id: "author-1", type: "48h_unfilled", post_id: "post-1" },
        ];

        expect(hasExistingNotification(notifications, "author-1", "48h_unfilled", "post-1")).toBe(true);
        expect(hasExistingNotification(notifications, "author-1", "48h_unfilled", "post-2")).toBe(false);
    });

    it("does not nudge regular_game posts", () => {
        expect(
            isEligibleFor48hNudge({
                status: "active",
                post_type: "regular_game",
                created_at: threeDaysAgo,
                game_date: futureDate,
                spots_total: 2,
                approved_count: 0,
            }),
        ).toBe(false);
    });

    it("does not nudge posts already expired", () => {
        expect(
            isEligibleFor48hNudge({
                status: "expired",
                post_type: "sub_need",
                created_at: threeDaysAgo,
                game_date: futureDate,
                spots_total: 2,
                approved_count: 0,
            }),
        ).toBe(false);
    });

    it("does not nudge posts created less than 48h ago", () => {
        expect(
            isEligibleFor48hNudge({
                status: "active",
                post_type: "sub_need",
                created_at: oneDayAgo,
                game_date: futureDate,
                spots_total: 2,
                approved_count: 0,
            }),
        ).toBe(false);
    });

    it("does not nudge posts with game_date in the past", () => {
        expect(
            isEligibleFor48hNudge({
                status: "active",
                post_type: "sub_need",
                created_at: threeDaysAgo,
                game_date: pastDate,
                spots_total: 2,
                approved_count: 0,
            }),
        ).toBe(false);
    });
});

describe("game-reminders", () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().slice(0, 10);

    const todayStr = now.toISOString().slice(0, 10);

    it("sends reminder day before game to poster and approved claimers", () => {
        expect(isEligibleForGameReminder({ status: "active", game_date: tomorrowStr })).toBe(true);

        const recipients = getGameReminderRecipients("poster-1", [
            { claimer_id: "claimer-a", status: "approved" },
            { claimer_id: "claimer-b", status: "approved" },
        ]);
        expect(recipients).toEqual(["poster-1", "claimer-a", "claimer-b"]);
    });

    it("does not send reminder to pending claimers", () => {
        const recipients = getGameReminderRecipients("poster-1", [
            { claimer_id: "claimer-a", status: "approved" },
            { claimer_id: "claimer-b", status: "pending" },
            { claimer_id: "claimer-c", status: "rejected" },
        ]);
        expect(recipients).toEqual(["poster-1", "claimer-a"]);
        expect(recipients).not.toContain("claimer-b");
        expect(recipients).not.toContain("claimer-c");
    });

    it("does not send reminder for games > 1 day away", () => {
        expect(
            isEligibleForGameReminder({ status: "active", game_date: dayAfterTomorrowStr }),
        ).toBe(false);
    });

    it("does not send reminder for games today", () => {
        expect(isEligibleForGameReminder({ status: "active", game_date: todayStr })).toBe(false);
    });

    it("deduplication — sent only once per post per recipient", () => {
        const notifications = [
            { user_id: "poster-1", type: "game_reminder", post_id: "post-1" },
            { user_id: "claimer-a", type: "game_reminder", post_id: "post-1" },
        ];

        // Already reminded
        expect(hasExistingNotification(notifications, "poster-1", "game_reminder", "post-1")).toBe(
            true,
        );
        expect(hasExistingNotification(notifications, "claimer-a", "game_reminder", "post-1")).toBe(
            true,
        );

        // Not yet reminded
        expect(hasExistingNotification(notifications, "claimer-b", "game_reminder", "post-1")).toBe(
            false,
        );
    });
});

describe("friend-expiry-alerts", () => {
    const twoHoursFromNowMs = Date.now() + 2 * 60 * 60 * 1000;
    const sixHoursFromNowMs = Date.now() + 6 * 60 * 60 * 1000;

    it("sends alert for unfilled friend posts within 4 hours of game", () => {
        expect(
            isEligibleForFriendExpiry({
                status: "active",
                post_type: "sub_need",
                game_datetime_ms: twoHoursFromNowMs,
                spots_total: 2,
                approved_count: 1,
            }),
        ).toBe(true);
    });

    it("does not alert for posts where all spots are approved", () => {
        expect(
            isEligibleForFriendExpiry({
                status: "active",
                post_type: "sub_need",
                game_datetime_ms: twoHoursFromNowMs,
                spots_total: 2,
                approved_count: 2,
            }),
        ).toBe(false);
    });

    it("does not alert for expired posts", () => {
        expect(
            isEligibleForFriendExpiry({
                status: "expired",
                post_type: "sub_need",
                game_datetime_ms: twoHoursFromNowMs,
                spots_total: 2,
                approved_count: 0,
            }),
        ).toBe(false);
    });

    it("deduplication — once per post per follower", () => {
        const notifications = [
            { user_id: "follower-1", type: "friend_expiry", post_id: "post-1" },
        ];

        expect(
            hasExistingNotification(notifications, "follower-1", "friend_expiry", "post-1"),
        ).toBe(true);
        expect(
            hasExistingNotification(notifications, "follower-2", "friend_expiry", "post-1"),
        ).toBe(false);
    });

    it("does not alert the poster themselves", () => {
        const followers = ["follower-1", "poster-1", "follower-2"];
        const filtered = filterFollowers(followers, "poster-1");
        expect(filtered).toEqual(["follower-1", "follower-2"]);
        expect(filtered).not.toContain("poster-1");
    });

    it("does not alert for games outside the 4-hour window", () => {
        expect(
            isEligibleForFriendExpiry({
                status: "active",
                post_type: "sub_need",
                game_datetime_ms: sixHoursFromNowMs,
                spots_total: 2,
                approved_count: 0,
            }),
        ).toBe(false);
    });
});

describe("auto-expire", () => {
    it("auto-expire sub_need posts after game date/time passes", () => {
        expect(
            shouldAutoExpire({
                status: "active",
                game_datetime_ms: Date.now() - 2 * 60 * 60 * 1000,
            }),
        ).toBe(true);
    });

    it("auto-expire does not affect active posts with future game dates", () => {
        expect(
            shouldAutoExpire({
                status: "active",
                game_datetime_ms: Date.now() + 24 * 60 * 60 * 1000,
            }),
        ).toBe(false);
    });

    it("does not re-expire already expired posts", () => {
        expect(
            shouldAutoExpire({
                status: "expired",
                game_datetime_ms: Date.now() - 2 * 60 * 60 * 1000,
            }),
        ).toBe(false);
    });
});
