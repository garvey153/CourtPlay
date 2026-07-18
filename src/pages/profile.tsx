import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { DotsVertical, SearchSm, XClose } from "@untitledui/icons";
import { SubCard } from "@/components/app/sub-card";
import { ReportModal } from "@/components/app/report-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { usePostSheets } from "@/hooks/use-post-sheets";
import { supabase } from "@/lib/supabase";
import type { FeedPost } from "@/types/feed";
import { skillLabel } from "@/utils/skill-label";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Types ──────────────────────────────────────────────────────────────────

interface ProfilePost {
    id: string;
    post_type: string;
    format: string | null;
    play_type: string | null;
    duration: number | null;
    notes: string | null;
    status: string;
    game_date: string | null;
    game_time: string | null;
    skill_level: string | null;
    location: string | null;
    custom_court: string | null;
    cost: number | null;
    spots_total: number;
    spots_available: number;
    created_at: string;
}

interface FollowUser {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    skill_level: string | null;
}

interface SearchUser extends FollowUser {
    new_to_westport: boolean;
    is_following: boolean;
}

interface ProfileData {
    id: string;
    first_name: string;
    last_name: string;
    headline: string | null;
    photo_url: string | null;
    skill_level: string | null;
    court_preferences: string[] | null;
    new_to_westport: boolean;
    follower_count: number;
    following_count: number;
    is_following: boolean;
    is_own_profile: boolean;
    active_posts: ProfilePost[];
    following_list: FollowUser[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a feed-style FeedPost from a profile's open post (author = the profile). */
function toFeedPost(post: ProfilePost, profile: ProfileData): FeedPost {
    return {
        id: post.id,
        author_id: profile.id,
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
        original_cost: null,
        spots_total: post.spots_total,
        series_id: null,
        notes: post.notes,
        status: post.status,
        view_count: 0,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: post.created_at,
        first_name: profile.first_name,
        last_name: profile.last_name,
        photo_url: profile.photo_url,
        is_friend: false,
        spots_available: post.spots_available,
        user_claim_status: null,
        user_claim_id: null,
        user_notify_me: false,
    };
}

/** Small avatar (photo or initial) used in the following/search rows. */
function RowAvatar({ photo, name }: { photo: string | null; name: string }) {
    return photo ? (
        <img src={photo} alt="" referrerPolicy="no-referrer" className="size-6 shrink-0 rounded-full object-cover" />
    ) : (
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-secondary">
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

/** "Chris L. · Intermediate" — first name + last initial + skill descriptor. */
function rowName(first: string, last: string, level: string | null): string {
    const name = last ? `${first} ${last.charAt(0)}.` : first;
    const skill = skillLabel(level);
    return skill ? `${name} · ${skill}` : name;
}

// ── Component ──────────────────────────────────────────────────────────────

export function Profile() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const { user, loading: authLoading } = useAuth();
    const profileId = (!id || id === "me") ? user?.id : id;

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Search state (own profile only)
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (authLoading) return;
        if (!profileId || (id && id !== "me" && !UUID_RE.test(profileId))) {
            setError("User not found.");
            setLoading(false);
            return;
        }
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc("get_profile", { p_user_id: profileId });
            if (rpcError || !data) {
                setError("User not found.");
            } else {
                setProfile(data as ProfileData);
            }
        } catch {
            setError("Failed to load profile.");
        }
        setLoading(false);
    }, [profileId, authLoading, id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    // Search users (finds any player with an active account)
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        const timer = setTimeout(async () => {
            const { data } = await supabase.rpc("search_users", { p_query: searchQuery.trim() });
            setSearchResults((data as SearchUser[]) ?? []);
            setSearchLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleFollow = useCallback(async (targetId: string) => {
        setSearchResults((prev) => prev.map((u) => (u.id === targetId ? { ...u, is_following: true } : u)));
        if (targetId === profileId) {
            setProfile((p) => (p ? { ...p, is_following: true, follower_count: p.follower_count + 1 } : p));
        }
        const { error: rpcError } = await supabase.rpc("follow_user", { p_following_id: targetId });
        if (rpcError) {
            setSearchResults((prev) => prev.map((u) => (u.id === targetId ? { ...u, is_following: false } : u)));
            fetchProfile();
        } else if (profile?.is_own_profile) {
            // Own profile: refresh so the new follow shows in the Following list + counts.
            fetchProfile();
        }
    }, [profileId, profile, fetchProfile]);

    const handleUnfollow = useCallback(async (targetId: string) => {
        setSearchResults((prev) => prev.map((u) => (u.id === targetId ? { ...u, is_following: false } : u)));
        setProfile((p) => {
            if (!p) return p;
            let next = p;
            if (targetId === profileId) {
                next = { ...next, is_following: false, follower_count: Math.max(0, next.follower_count - 1) };
            }
            if (next.following_list.some((f) => f.id === targetId)) {
                next = {
                    ...next,
                    following_list: next.following_list.filter((f) => f.id !== targetId),
                    following_count: Math.max(0, next.following_count - 1),
                };
            }
            return next;
        });
        const { error: rpcError } = await supabase.rpc("unfollow_user", { p_following_id: targetId });
        if (rpcError) fetchProfile();
    }, [profileId, fetchProfile]);

    // Tapping a post opens the same bottom sheet as the feed (creator sheet for your
    // own post, claim/connect sheet for others'). Refresh the profile after any change.
    const { openDetail, sheets } = usePostSheets({ onChanged: fetchProfile, editReturnTo: location.pathname });

    if (loading) {
        return (
            <AppLayout>
                <div className="flex flex-1 items-center justify-center py-16">
                    <div className="size-8 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                </div>
            </AppLayout>
        );
    }

    if (error || !profile) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-base font-semibold text-primary">{error ?? "User not found"}</p>
                    <button
                        onClick={fetchProfile}
                        className="rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                    >
                        Retry
                    </button>
                </div>
            </AppLayout>
        );
    }

    const label = skillLabel(profile.skill_level);
    const isSearching = searchQuery.trim().length >= 2;
    // The Posts section shows the user's Open, Claimed, and Expired posts (the
    // SubCard derives which from status + spots + game time). Hide posts missing
    // required info: every post needs a court, and dated (sub_need) posts need a
    // date. Regular-game posts are dateless by design, so they're exempt.
    const posts = profile.active_posts.filter(
        (p) => (p.location || p.custom_court) && (p.post_type === "regular_game" || p.game_date),
    );

    return (
        <AppLayout>
            <div className="px-5 pt-2 pb-6">
                {/* Header: avatar + name + skill label (+ Edit profile on own) */}
                <div className="flex items-center gap-3">
                    {/* Design-system "Avatar profile photo" (348:2158): 72px with a
                        3px white ring + subtle border around the photo. */}
                    <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full border border-secondary_alt bg-white p-[3px] shadow-xs">
                        {profile.photo_url ? (
                            <img
                                src={profile.photo_url}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="size-full rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex size-full items-center justify-center rounded-full bg-tertiary text-2xl font-semibold text-secondary">
                                {profile.first_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-xl font-bold text-primary">
                            {profile.first_name} {profile.last_name}
                        </h1>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm">
                            {label && <span className="text-tertiary">{label}</span>}
                            {profile.is_own_profile && (
                                <>
                                    {label && <span className="text-tertiary" aria-hidden="true">·</span>}
                                    <Link
                                        to="/profile/edit"
                                        className="font-medium text-brand-500 hover:text-brand-600"
                                    >
                                        Edit profile
                                    </Link>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Overflow menu (report) for other users' profiles */}
                    {!profile.is_own_profile && (
                        <div className="relative">
                            <button
                                className="rounded p-1 text-quaternary hover:text-tertiary"
                                onClick={() => setShowReport(!showReport)}
                                aria-label="More options"
                            >
                                <DotsVertical className="size-5" />
                            </button>
                            {showReport && (
                                <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-secondary bg-primary py-1 shadow-lg">
                                    <button
                                        className="w-full px-4 py-2 text-left text-sm text-error-primary hover:bg-secondary"
                                        onClick={() => {
                                            setShowReport(false);
                                            setShowReportModal(true);
                                        }}
                                    >
                                        Report this user
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Stats cards */}
                <div className="mt-5 flex gap-3">
                    <div className="w-[86px] rounded-lg bg-secondary px-4 py-3">
                        <p className="text-lg font-semibold leading-7 text-brand-500">{profile.follower_count}</p>
                        <p className="mt-0.5 text-xs text-tertiary">Followers</p>
                    </div>
                    <div className="w-[86px] rounded-lg bg-secondary px-4 py-3">
                        <p className="text-lg font-semibold leading-7 text-brand-500">{profile.following_count}</p>
                        <p className="mt-0.5 text-xs text-tertiary">Following</p>
                    </div>
                </div>

                {/* Follow / Following CTA (other users only) */}
                {!profile.is_own_profile && (
                    <button
                        onClick={() => (profile.is_following ? handleUnfollow(profile.id) : handleFollow(profile.id))}
                        className="mt-5 w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600"
                    >
                        {profile.is_following ? "Following" : "Follow"}
                    </button>
                )}

                {/* Posts (feed-style cards) — Open, Claimed, and Expired */}
                <div className="mt-6">
                    <p className="mb-3 text-sm font-semibold text-tertiary">
                        Posts ({posts.length})
                    </p>
                    {posts.length === 0 ? (
                        <p className="text-sm text-tertiary">No posts.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {posts.map((post) => (
                                <SubCard
                                    key={post.id}
                                    post={toFeedPost(post, profile)}
                                    currentUserId={user?.id}
                                    onOpenDetail={openDetail}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Following + search (own profile only) */}
                {profile.is_own_profile && (
                    <div className="mt-4">
                        <p className="mb-1.5 text-sm font-semibold text-tertiary">
                            Following ({profile.following_count})
                        </p>

                        {/* Search field — matches the filter sheet's location search */}
                        <div className="mb-4 flex h-9 items-center gap-2 rounded-lg border border-neutral-700 px-3 shadow-xs">
                            <SearchSm className="size-6 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
                            <input
                                className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                                placeholder="Search for players to follow..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoComplete="off"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => setSearchQuery("")}
                                    className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-primary"
                                >
                                    <XClose className="size-5" strokeWidth={1} />
                                </button>
                            )}
                        </div>

                        {/* Search results, or the current Following list */}
                        {isSearching ? (
                            searchLoading ? (
                                <p className="py-3 text-sm text-tertiary">Searching…</p>
                            ) : searchResults.length === 0 ? (
                                <p className="py-3 text-sm text-tertiary">No players found.</p>
                            ) : (
                                <div className="flex flex-col">
                                    {searchResults.map((su) => (
                                        <div key={su.id} className="flex items-center gap-2 py-2.5">
                                            <Link to={`/profile/${su.id}`}>
                                                <RowAvatar photo={su.photo_url} name={su.first_name} />
                                            </Link>
                                            <Link
                                                to={`/profile/${su.id}`}
                                                className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                                            >
                                                {rowName(su.first_name, su.last_name, su.skill_level)}
                                            </Link>
                                            {su.is_following ? (
                                                <span className="shrink-0 text-sm font-medium text-tertiary">Following</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleFollow(su.id)}
                                                    className="shrink-0 text-sm font-medium text-brand-secondary hover:text-brand-secondary_hover"
                                                >
                                                    Follow
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : profile.following_list.length === 0 ? (
                            <p className="py-1 text-sm text-tertiary">You're not following anyone yet.</p>
                        ) : (
                            <div className="flex flex-col">
                                {profile.following_list.map((fu) => (
                                    <div key={fu.id} className="flex items-center gap-2 py-2.5">
                                        <Link to={`/profile/${fu.id}`}>
                                            <RowAvatar photo={fu.photo_url} name={fu.first_name} />
                                        </Link>
                                        <Link
                                            to={`/profile/${fu.id}`}
                                            className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                                        >
                                            {rowName(fu.first_name, fu.last_name, fu.skill_level)}
                                        </Link>
                                        <button
                                            onClick={() => handleUnfollow(fu.id)}
                                            className="shrink-0 text-sm font-medium text-brand-secondary hover:text-brand-secondary_hover"
                                        >
                                            Unfollow
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showReportModal && profile && (
                <ReportModal
                    targetType="user"
                    targetId={profile.id}
                    onClose={() => setShowReportModal(false)}
                />
            )}

            {sheets}
        </AppLayout>
    );
}
