/**
 * The fake account behind every tutorial screenshot.
 *
 * NO REAL PLAYER DATA MAY APPEAR IN A TUTORIAL IMAGE. Everything here is
 * invented, and the invented players are deliberately the same three the
 * landing page already uses (`src/pages/landing.tsx`) — Chris B., Maria L. and
 * Dan K., with the avatars already committed under `public/avatars/`. Reusing
 * them keeps one consistent fiction across the marketing page and the tutorial,
 * and adds no new photos.
 *
 * Courts are real public venues (`mockCourts` in src/test/mocks/fixtures.ts),
 * which carry no personal data.
 *
 * EVERYTHING HERE MUST BE DETERMINISTIC. The capture script and the fingerprint
 * test render this same data in two different engines and compare the result;
 * a random id or a live clock would make them disagree forever. So: literal
 * ids, and every relative time derived from DEMO_NOW rather than Date.now().
 * Note that makePost() in src/test/mocks/fixtures.ts uses crypto.randomUUID()
 * and must not be reused here.
 */
import type { FeedPost } from "@/types/feed";
import type { MyPost } from "@/types/activity";
import type { UserProfile } from "@/providers/profile-provider";
import type { GroupSummary } from "@/types/groups";

/** The instant every demo screen believes it is. Parsed by the capture script. */
export const DEMO_NOW = "2026-05-14T13:00:00.000Z";

const nowMs = Date.parse(DEMO_NOW);
/** Minutes before DEMO_NOW, as an ISO string. */
const ago = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString();

export const DEMO_VIEWER_ID = "demo-viewer";

// Surnames are single letters on purpose. The detail sheets render
// `${first_name} ${last_name}.`, so a full surname would read "Chris Bell." in
// a tutorial image. This also matches the landing page's existing fiction,
// where the same three players are already shown as Chris B., Maria L., Dan K.

/** The player whose eyes we are looking through. No phone or venmo on purpose. */
export const DEMO_PROFILE: UserProfile = {
    id: DEMO_VIEWER_ID,
    email: "alex@example.com",
    first_name: "Alex",
    last_name: "Rivera",
    headline: null,
    photo_url: "/avatars/alex.jpg",
    skill_level: "4.0",
    court_preferences: ["Longshore Club"],
    pro_preference: null,
    new_to_westport: false,
    is_admin: false,
    feed_connected_only: false,
    onesignal_player_id: null,
    tutorial_seen_at: null,
};

const basePost = {
    author_type: "player" as const,
    format: null,
    total_players: null,
    court_id: null,
    custom_court: null,
    pro_name: null,
    original_cost: null,
    series_id: null,
    status: "active",
    view_count: 0,
    expires_at: null,
    preferred_days: null,
    preferred_times: null,
    is_tagged: false,
    user_claim_status: null,
    user_claim_id: null,
    user_notify_me: false,
};

/** A "Find a sub" post from a player you follow — hence the Friend badge. */
export const DEMO_SUB_POST: FeedPost = {
    ...basePost,
    id: "demo-post-sub",
    author_id: "demo-chris",
    post_type: "sub_need",
    play_type: "doubles",
    duration: 2,
    game_date: "2026-05-16",
    game_time: "09:00",
    skill_level: "3.5",
    location: "Longshore Club",
    cost: 25,
    spots_total: 1,
    spots_available: 1,
    notes: "One of our four is out. Friendly game, we play every Saturday.",
    created_at: ago(20),
    first_name: "Chris",
    last_name: "B",
    photo_url: "/avatars/chris.jpg",
    is_friend: true,
    is_connected: true,
};

/** A second sub post, already taken — so the feed shows both states. */
export const DEMO_CLAIMED_POST: FeedPost = {
    ...basePost,
    id: "demo-post-claimed",
    author_id: "demo-dan",
    post_type: "sub_need",
    play_type: "point_play",
    duration: 1,
    game_date: "2026-05-20",
    game_time: "18:00",
    skill_level: "3.0",
    location: "Compo Beach Courts",
    cost: 15,
    spots_total: 1,
    spots_available: 0,
    notes: null,
    created_at: ago(180),
    first_name: "Dan",
    last_name: "K",
    photo_url: "/avatars/dan.jpg",
    is_friend: false,
    is_connected: false,
};

/** A "Find a regular game" post — the blue card, no date and no price. */
export const DEMO_REGULAR_POST: FeedPost = {
    ...basePost,
    id: "demo-post-regular",
    author_id: "demo-maria",
    post_type: "regular_game",
    play_type: "doubles",
    duration: null,
    game_date: null,
    game_time: null,
    skill_level: "4.0",
    location: "Westport Tennis Club",
    cost: null,
    spots_total: 1,
    spots_available: 1,
    notes: "New to the area and looking for a regular doubles group.",
    created_at: ago(60),
    preferred_days: ["Mon", "Wed"],
    preferred_times: ["Evening"],
    first_name: "Maria",
    last_name: "L",
    photo_url: "/avatars/maria.jpg",
    is_friend: false,
    is_connected: false,
};

/** The viewer's own post, with one claim waiting on their decision. */
export const DEMO_MY_POST: MyPost = {
    id: "demo-my-post",
    post_type: "sub_need",
    format: null,
    play_type: "doubles",
    duration: 2,
    skill_level: "4.0",
    notes: "Need a fourth for our regular Sunday game.",
    game_date: "2026-05-18",
    game_time: "10:00",
    location: "Longshore Club",
    custom_court: null,
    preferred_days: null,
    preferred_times: null,
    cost: 30,
    original_cost: null,
    spots_total: 1,
    spots_available: 1,
    status: "active",
    created_at: ago(240),
    series_id: null,
    deleted_at: null,
    deleted_by: null,
    claims: [
        {
            id: "demo-claim",
            status: "pending",
            created_at: ago(15),
            claimer_id: "demo-maria",
            first_name: "Maria",
            last_name: "L",
            photo_url: "/avatars/maria.jpg",
            skill_level: "4.0",
            venmo_handle: null,
            phone: null,
            messages: [
                {
                    id: "demo-message",
                    sender_id: "demo-maria",
                    body: "I can make 10am — happy to take the spot!",
                    created_at: ago(14),
                    first_name: "Maria",
                    last_name: "L",
                    photo_url: "/avatars/maria.jpg",
                },
            ],
        },
    ],
};

/** Two groups for the profile screen — one healthy, one closed. */
export const DEMO_GROUPS: GroupSummary[] = [
    {
        id: "demo-group-1",
        name: "Sunday Doubles",
        details: "Longshore Club",
        // Not the creator, and joined recently: both are required for the feed's
        // "You're in a group" banner, which step 1 is meant to show.
        is_creator: false,
        is_closed: false,
        closed_at: null,
        joined_at: ago(45),
        my_removed_at: null,
        removed_by_me: false,
        member_count: 4,
        members: [
            { id: "demo-chris", first_name: "Chris", last_name: "B", photo_url: "/avatars/chris.jpg" },
            { id: "demo-maria", first_name: "Maria", last_name: "L", photo_url: "/avatars/maria.jpg" },
            { id: "demo-dan", first_name: "Dan", last_name: "K", photo_url: "/avatars/dan.jpg" },
            { id: DEMO_VIEWER_ID, first_name: "Alex", last_name: "R", photo_url: "/avatars/alex.jpg" },
        ],
    },
    {
        id: "demo-group-2",
        name: "Winter League",
        details: "Westport Tennis Club",
        is_creator: true,
        is_closed: false,
        closed_at: null,
        joined_at: ago(60 * 24 * 90),
        my_removed_at: null,
        removed_by_me: false,
        member_count: 2,
        members: [
            { id: "demo-maria", first_name: "Maria", last_name: "L", photo_url: "/avatars/maria.jpg" },
            { id: DEMO_VIEWER_ID, first_name: "Alex", last_name: "R", photo_url: "/avatars/alex.jpg" },
        ],
    },
];

/**
 * Two of the demo player's own posts, both open — the Created posts tab as the
 * design shows it. No claims: a claim would file a post under Pending rather
 * than Active, and the badge would read Claimed rather than Open.
 */
export const DEMO_CREATED_POSTS: MyPost[] = [
    {
        ...DEMO_MY_POST,
        id: "demo-created-1",
        claims: [],
    },
    {
        ...DEMO_MY_POST,
        id: "demo-created-2",
        play_type: "point_play",
        skill_level: "3.5",
        game_date: "2026-05-23",
        game_time: "18:00",
        location: "Compo Beach Courts",
        duration: 1,
        cost: 15,
        notes: "Regular Saturday four, one out this week.",
        created_at: ago(300),
        claims: [],
    },
];

/** What get_profile returns for the demo player's own profile. */
export const DEMO_PROFILE_PAGE = {
    id: DEMO_VIEWER_ID,
    first_name: "Alex",
    last_name: "Rivera",
    headline: null,
    photo_url: "/avatars/alex.jpg",
    skill_level: "4.0",
    court_preferences: ["Longshore Club"],
    new_to_westport: false,
    follower_count: 24,
    following_count: 2,
    is_following: false,
    is_own_profile: true,
    active_posts: [],
    following_list: [
        { id: "demo-chris", first_name: "Chris", last_name: "B", photo_url: "/avatars/chris.jpg", skill_level: "3.5" },
        { id: "demo-maria", first_name: "Maria", last_name: "L", photo_url: "/avatars/maria.jpg", skill_level: "4.0" },
    ],
};

/** The answered-posts tab: a spot this player claimed. */
export const DEMO_MY_CLAIMS = [
    {
        id: "demo-my-claim",
        status: "approved",
        created_at: ago(120),
        rejection_reason: null,
        post_id: DEMO_SUB_POST.id,
        post_type: "sub_need",
        play_type: "doubles",
        duration: 2,
        skill_level: "3.5",
        notes: DEMO_SUB_POST.notes,
        game_date: DEMO_SUB_POST.game_date,
        game_time: DEMO_SUB_POST.game_time,
        location: DEMO_SUB_POST.location,
        custom_court: null,
        cost: 25,
        original_cost: null,
        status_post: "active",
        poster_id: "demo-chris",
        poster_first_name: "Chris",
        poster_last_name: "B",
        poster_photo_url: "/avatars/chris.jpg",
        poster_venmo_handle: null,
        poster_phone: null,
        messages: [],
    },
];

/** The poster of DEMO_MY_POST, as the created sheet wants them. */
export const DEMO_POSTER = {
    first_name: DEMO_PROFILE.first_name,
    last_name: DEMO_PROFILE.last_name,
    photo_url: DEMO_PROFILE.photo_url,
};
