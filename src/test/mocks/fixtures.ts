// Mock user
export const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    first_name: "Test",
    last_name_initial: "U",
    skill_level: "4.0",
};

// Mock courts
export const mockCourts = [
    { id: "court-1", name: "Longshore Club", area: "Westport", active: true },
    { id: "court-2", name: "Staples High School", area: "Westport", active: true },
    { id: "court-3", name: "Weston Field Club", area: "Weston", active: true },
];

// Valid sub_need post (all required fields filled)
export const validSubNeedPost = {
    post_type: "sub_need",
    format: "point_play",
    total_players: 4,
    game_date: "2026-04-15",
    game_time: "09:00",
    skill_level: "4.0",
    court_id: "court-1",
    cost: 25.0,
    spots_total: 1,
    notes: "",
};

// Valid regular_game post
export const validRegularGamePost = {
    post_type: "regular_game",
    format: "point_play",
    skill_level: "3.5",
    preferred_days: ["Monday", "Wednesday"],
    preferred_times: ["Morning"],
    court_id: "court-2",
    notes: "Looking for consistent group",
};

// A fully formed post row as returned by Supabase (matches FeedPost interface)
export function makePost(overrides: Record<string, unknown> = {}) {
    return {
        id: crypto.randomUUID(),
        author_id: mockUser.id,
        author_type: "player",
        post_type: "sub_need",
        status: "active",
        format: "point_play",
        total_players: 4,
        game_date: "2026-04-15",
        game_time: "09:00",
        skill_level: "4.0",
        location: "Longshore Club",
        court_id: "court-1",
        custom_court: null,
        pro_name: null,
        cost: 25,
        original_cost: null,
        spots_total: 1,
        spots_available: 1,
        view_count: 0,
        notes: null,
        series_id: null,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Test",
        last_name: "User",
        photo_url: null,
        is_friend: false,
        ...overrides,
    };
}
