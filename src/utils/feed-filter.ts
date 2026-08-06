import { gameEndMs } from "@/components/app/sub-card";
import type { FeedPost, FilterState } from "@/types/feed";

/**
 * The feed's client-side filtering, extracted from feed.tsx so tests can import
 * the real thing.
 *
 * It previously lived in the page, and feed-filters.test.tsx kept a hand-copied
 * mirror of it — which meant a change to the page could not fail that test.
 * Adding the connectedOnly parameter proved the point: the mirror still passed
 * without it.
 */

// Dated posts stay in the feed until 24h after their game date/time; after that
// they drop off. Undated posts (e.g. regular-game availability) are unaffected.
const FEED_GRACE_MS = 24 * 60 * 60 * 1000;

export function withinFeedWindow(post: FeedPost): boolean {
    const end = gameEndMs(post);
    return end === null || Date.now() <= end + FEED_GRACE_MS;
}

/**
 * @param connectedOnly The viewer's saved preference (Edit profile → Feed).
 * Passed in rather than read from context so this stays pure and testable.
 */
export function applyFilters(posts: FeedPost[], f: FilterState, connectedOnly = false): FeedPost[] {
    return posts.filter((p) => {
        if (!withinFeedWindow(p)) return false;
        if (connectedOnly && !p.is_connected) return false;
        if (f.skillLevels.length > 0 && !f.skillLevels.includes(p.skill_level ?? "")) return false;
        // sub_need posts store their type in play_type; regular_game in format.
        if (f.formats.length > 0 && !f.formats.includes(p.play_type ?? p.format ?? "")) return false;
        if (f.dateFrom && p.game_date && p.game_date < f.dateFrom) return false;
        if (f.dateTo && p.game_date && p.game_date > f.dateTo) return false;
        if (f.courtIds.length > 0 && !f.courtIds.includes(p.court_id ?? "")) return false;
        return true;
    });
}
