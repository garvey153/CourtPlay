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
    spots_available: number;
    user_claim_status: "pending" | "approved" | "rejected" | "unclaimed" | "cancelled" | null;
    user_claim_id: string | null;
    user_notify_me: boolean;
}

export interface FilterState {
    skillLevels: string[];
    formats: string[];
    dateFrom: string | null;
    dateTo: string | null;
    courtId: string | null;
}
