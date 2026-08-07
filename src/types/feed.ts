export interface FeedPost {
    id: string;
    author_id: string;
    author_type: "player" | "pro" | "club";
    post_type: "sub_need" | "regular_game";
    format: string | null;
    play_type: string | null;
    duration: number | null;
    total_players: number | null;
    game_date: string | null;
    game_time: string | null;
    skill_level: string | null;
    location: string | null;
    court_id: string | null;
    custom_court: string | null;
    pro_name: string | null;
    cost: number | null;
    original_cost: number | null;
    spots_total: number;
    series_id: string | null;
    notes: string | null;
    status: string;
    view_count: number;
    expires_at: string | null;
    preferred_days: string[] | null;
    preferred_times: string[] | null;
    created_at: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    is_friend: boolean;
    /**
     * You follow this author, or you share an active group with them. Broader
     * than is_friend, which stays follow-only because the "Friend" badge on the
     * card reads from it.
     */
    is_connected: boolean;
    /**
     * You're in the group this sub will be playing with — so the post is about
     * your own game, and the spot isn't yours to take. Drives the dimmed card
     * variant and the no-claim sheet, and the server refuses your claim to
     * match. Independent of visibility: can_see_post already decided that, and
     * a false value on a visible post is the ordinary case, not a denial.
     */
    is_tagged: boolean;
    /** Name of that group, returned only to its members. Null otherwise. */
    tagged_group_name?: string | null;
    spots_available: number;
    user_claim_status: "pending" | "approved" | "rejected" | "unclaimed" | "cancelled" | null;
    user_claim_id: string | null;
    user_notify_me: boolean;
}

/**
 * A post whose tagged group you're in, from get_my_tagged_posts.
 *
 * Only what the feed banners need — the claim's status is what decides between
 * the "claimed" and "approved" notices, so no separate events table is needed.
 */
export interface TaggedPost {
    id: string;
    play_type: string | null;
    format: string | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    custom_court: string | null;
    created_at: string;
    group_name: string;
    poster_first_name: string;
    claim_id: string | null;
    claim_status: "pending" | "approved" | null;
    claimer_first_name: string | null;
}

export interface FilterState {
    skillLevels: string[];
    formats: string[];
    dateFrom: string | null;
    dateTo: string | null;
    courtIds: string[];
}
