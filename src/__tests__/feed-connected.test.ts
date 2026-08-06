import { describe, expect, it } from "vitest";
import { applyFilters } from "@/utils/feed-filter";
import type { FeedPost, FilterState } from "@/types/feed";

/**
 * The "only show posts from my groups and players I'm following" preference
 * (Edit profile → Feed), applied client-side from users.feed_connected_only.
 *
 * The server decides WHO is connected — is_connected covers both follows and
 * shared active groups. This only covers what the client does with that answer.
 */

const NO_FILTERS: FilterState = {
    skillLevels: [],
    formats: [],
    dateFrom: null,
    dateTo: null,
    courtIds: [],
};

const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

function post(over: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "p1",
        author_id: "a1",
        author_type: "player",
        post_type: "sub_need",
        format: null,
        play_type: "doubles",
        duration: 2,
        total_players: null,
        game_date: future,
        game_time: "10:00",
        skill_level: "4.0",
        location: "Longshore",
        court_id: "c1",
        custom_court: null,
        pro_name: null,
        cost: 20,
        original_cost: null,
        spots_total: 1,
        series_id: null,
        notes: null,
        status: "active",
        view_count: 0,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Chris",
        last_name: "Bell",
        photo_url: null,
        is_friend: false,
        is_connected: false,
        spots_available: 1,
        user_claim_status: null,
        user_claim_id: null,
        user_notify_me: false,
        ...over,
    };
}

describe("feed_connected_only", () => {
    const connected = post({ id: "connected", is_connected: true });
    const stranger = post({ id: "stranger", is_connected: false });

    it("shows everything when the preference is off", () => {
        const out = applyFilters([connected, stranger], NO_FILTERS, false);
        expect(out.map((p) => p.id)).toEqual(["connected", "stranger"]);
    });

    it("defaults to off when the flag is omitted", () => {
        expect(applyFilters([connected, stranger], NO_FILTERS)).toHaveLength(2);
    });

    it("drops unconnected posts when the preference is on", () => {
        const out = applyFilters([connected, stranger], NO_FILTERS, true);
        expect(out.map((p) => p.id)).toEqual(["connected"]);
    });

    it("keys off is_connected, not is_friend — a group-mate you don't follow still shows", () => {
        // This is the case that distinguishes the two flags: shared group, no
        // follow. is_friend stays false so the card's Friend badge stays off.
        const groupMate = post({ id: "group-mate", is_connected: true, is_friend: false });
        const out = applyFilters([groupMate], NO_FILTERS, true);
        expect(out).toHaveLength(1);
    });

    it("combines with the other filters rather than replacing them", () => {
        const connectedWrongSkill = post({ id: "wrong-skill", is_connected: true, skill_level: "3.0" });
        const out = applyFilters([connected, connectedWrongSkill, stranger], { ...NO_FILTERS, skillLevels: ["4.0"] }, true);
        expect(out.map((p) => p.id)).toEqual(["connected"]);
    });

    it("still drops a connected post that is past its game window", () => {
        // Connectedness must not exempt a post from the feed window, or expired
        // posts from your group would linger at the top of the feed forever.
        const stale = post({ id: "stale", is_connected: true, game_date: "2020-01-01", game_time: "10:00" });
        expect(applyFilters([stale], NO_FILTERS, true)).toHaveLength(0);
    });
});
