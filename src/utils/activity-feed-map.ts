import type { CardKind } from "@/components/app/sub-card";
import type { FeedPost } from "@/types/feed";
import type { MyClaim, MyPost } from "@/types/activity";
import type { ClaimDisplayState, PostDisplayState } from "./activity-states";

/** Map a claim's display state to the shared card badge kind. */
export function claimKind(state: ClaimDisplayState): CardKind {
    return state; // ClaimDisplayState values are all valid CardKinds
}

/** Map a post's display state to the shared card badge kind. */
export function postKind(state: PostDisplayState): CardKind {
    switch (state) {
        case "active":
            return "open";
        case "claimed":
        case "filled":
            return "approved";
        default:
            return state; // pending, completed, expired, cancelled
    }
}

/**
 * Build a FeedPost-shaped object from a claim (Claimed tab). The card's "poster"
 * is the post's author; user_claim_status/id carry the claim so the detail sheet
 * opens straight into the pending/approved state.
 */
export function claimToFeedPost(claim: MyClaim): FeedPost {
    return {
        id: claim.post_id,
        author_id: claim.poster_id,
        author_type: "player",
        post_type: claim.post_type as FeedPost["post_type"],
        format: claim.format,
        play_type: claim.play_type,
        duration: claim.duration,
        total_players: null,
        game_date: claim.game_date,
        game_time: claim.game_time,
        skill_level: claim.skill_level,
        location: claim.location,
        court_id: null,
        custom_court: claim.custom_court,
        pro_name: null,
        cost: claim.cost,
        original_cost: null,
        spots_total: 1,
        series_id: null,
        notes: claim.notes,
        status: claim.post_status,
        view_count: 0,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: claim.created_at,
        first_name: claim.poster_first_name,
        last_name: claim.poster_last_name,
        photo_url: claim.poster_photo_url,
        is_friend: false,
        spots_available: 0,
        user_claim_status: claim.status,
        user_claim_id: claim.id,
        user_notify_me: false,
    };
}

interface Me {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
}

/**
 * Build a FeedPost-shaped object from one of my posts (Created tab). The card's
 * "poster" is me (the author).
 */
export function postToFeedPost(post: MyPost, me: Me): FeedPost {
    return {
        id: post.id,
        author_id: me.id,
        author_type: "player",
        post_type: post.post_type as FeedPost["post_type"],
        format: post.format,
        play_type: post.play_type,
        duration: post.duration,
        total_players: null,
        game_date: post.game_date,
        game_time: post.game_time,
        skill_level: post.skill_level,
        location: post.location,
        court_id: null,
        custom_court: post.custom_court,
        pro_name: null,
        cost: post.cost,
        original_cost: post.original_cost,
        spots_total: post.spots_total,
        series_id: post.series_id,
        notes: post.notes,
        status: post.status,
        view_count: 0,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: post.created_at,
        first_name: me.first_name,
        last_name: me.last_name,
        photo_url: me.photo_url,
        is_friend: false,
        spots_available: post.spots_available,
        user_claim_status: null,
        user_claim_id: null,
        user_notify_me: false,
    };
}
