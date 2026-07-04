import type { ClaimStatus, RejectionReason } from "./claims";

/** A claim on one of my posts (creator view). */
export interface ClaimRow {
    id: string;
    status: ClaimStatus;
    created_at: string;
    claimer_id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    skill_level: string | null;
    venmo_handle: string | null;
    phone: string | null;
}

/** One of my created posts, with its claims (Created tab). */
export interface MyPost {
    id: string;
    post_type: string;
    format: string | null;
    play_type: string | null;
    duration: number | null;
    skill_level: string | null;
    notes: string | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    custom_court: string | null;
    cost: number | null;
    original_cost: number | null;
    spots_total: number;
    spots_available: number;
    status: string;
    created_at: string;
    series_id: string | null;
    deleted_at: string | null;
    deleted_by: string | null;
    claims: ClaimRow[];
}

/** A post I've claimed (Claimed tab). */
export interface MyClaim {
    id: string;
    status: ClaimStatus;
    created_at: string;
    rejection_reason: RejectionReason | null;
    post_id: string;
    post_type: string;
    post_status: string;
    format: string | null;
    play_type: string | null;
    duration: number | null;
    skill_level: string | null;
    notes: string | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    custom_court: string | null;
    cost: number | null;
    poster_id: string;
    poster_first_name: string;
    poster_last_name: string;
    poster_photo_url: string | null;
    poster_venmo_handle: string | null;
    poster_phone: string | null;
}
