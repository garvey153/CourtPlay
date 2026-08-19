import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { DotsVertical } from "@untitledui/icons";
import { ReportUserSheet } from "@/components/app/report-user-sheet";
import { FeedbackSheet } from "@/components/app/feedback-sheet";
import { SearchField } from "@/components/base/input/search-field";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { skillLabel } from "@/utils/skill-label";
import { LoadingState } from "@/components/application/loading-indicator/spinner";
import { InvitePlayerSheet } from "@/components/app/invite-player-sheet";
import { GroupCard } from "@/components/app/group-card";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";
import { GroupFormSheet } from "@/components/app/group-form-sheet";
import { GroupDetailSheet } from "@/components/app/group-detail-sheet";
import { type GroupSummary } from "@/types/groups";

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
    const { user, loading: authLoading } = useAuth();
    const profileId = (!id || id === "me") ? user?.id : id;

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    // A profile that does not exist is a different outcome from a failed request.
    const [notFound, setNotFound] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    // Tap the version stamp to reveal on-device push diagnostics (debugging aid).

    // Search state (own profile only)
    const [searchQuery, setSearchQuery] = useState("");

    // Groups live on the caller's own profile only, so they load from
    // get_my_groups rather than being folded into get_profile — which is shared
    // with other players' profiles and has no business returning them.
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    // Whether get_my_groups has answered. `groups.length === 0` cannot tell "not
    // fetched yet" from "you have none", and rendering the empty state during
    // that window made it flash on every page load — the same defect the welcome
    // banner had (see welcome-banner-flash.test.ts).
    const [groupsLoaded, setGroupsLoaded] = useState(false);
    const [openGroupId, setOpenGroupId] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    /** `{}` opens the create form; `{groupId}` opens it in edit mode. */
    const [formOpen, setFormOpen] = useState<{ groupId?: string } | null>(null);

    const fetchGroups = useCallback(async () => {
        const { data, error: rpcError } = await supabase.rpc("get_my_groups");
        if (rpcError) {
            console.error("get_my_groups failed:", rpcError);
            // Still "loaded": the section shows its empty state rather than
            // hanging, and Profile has no retry affordance for this sub-fetch.
            setGroupsLoaded(true);
            return;
        }
        // get_my_groups also returns groups you were recently REMOVED from, so
        // the feed can say so. Those must not be listed as groups you're in.
        const all = Array.isArray(data) ? (data as GroupSummary[]) : [];
        setGroups(all.filter((g) => !g.my_removed_at));
        setGroupsLoaded(true);
    }, []);
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (authLoading) return;
        if (!profileId || (id && id !== "me" && !UUID_RE.test(profileId))) {
            setNotFound(true);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc("get_profile", { p_user_id: profileId });
            if (rpcError) {
                // A failed request is not the same as a profile that isn't there.
                console.error("get_profile failed:", rpcError);
                setError(rpcError);
                setNotFound(false);
            } else if (!data) {
                setNotFound(true);
            } else {
                setProfile(data as ProfileData);
            }
        } catch (e) {
            setError(e);
        }
        setLoading(false);
    }, [profileId, authLoading, id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    // Own profile only; get_my_groups is scoped to the caller regardless, but
    // there is no reason to call it while looking at someone else.
    //
    // Keyed off the URL rather than profile.is_own_profile, which only arrives
    // once get_profile resolves — waiting for it guaranteed a gap where the
    // groups section had no data to show.
    const isOwnProfile = !!user?.id && profileId === user.id;
    useEffect(() => {
        if (isOwnProfile) fetchGroups();
    }, [isOwnProfile, fetchGroups]);

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

    if (loading) {
        return (
            <AppLayout>
                <LoadingState />
            </AppLayout>
        );
    }

    if (notFound && !error) {
        return (
            <AppLayout>
                <EmptyState title="No match for that player" description="This profile doesn't exist, or it's no longer available." />
            </AppLayout>
        );
    }

    if (error || !profile) {
        return (
            <AppLayout>
                <ErrorState error={error} subject="this profile" onRetry={fetchProfile} />
            </AppLayout>
        );
    }

    const label = skillLabel(profile.skill_level);
    const isSearching = searchQuery.trim().length >= 2;

    return (
        <AppLayout>
            <div className="px-5 pt-2 pb-6">
                {/* Header: avatar + name + skill label (+ Manage on own) */}
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
                                        Manage
                                    </Link>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Overflow menu (report) for other users' profiles — opens the report sheet. */}
                    {!profile.is_own_profile && (
                        <button
                            className="rounded p-1 text-quaternary hover:text-tertiary"
                            onClick={() => setShowReportModal(true)}
                            aria-label="More options"
                        >
                            <DotsVertical className="size-5" />
                        </button>
                    )}
                </div>

                {/* Stats cards. Groups is own-profile only — group membership is
                    private, so there is nothing to show on someone else's profile. */}
                <div className="mt-5 flex gap-3">
                    {profile.is_own_profile && (
                        <div className="w-[86px] rounded-lg bg-secondary px-4 py-3">
                            <p className="text-lg font-semibold leading-7 text-brand-500">
                                {groupsLoaded ? groups.length : "—"}
                            </p>
                            <p className="mt-0.5 text-xs text-tertiary">
                                {groupsLoaded && groups.length === 1 ? "Group" : "Groups"}
                            </p>
                        </div>
                    )}
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

                {/* Groups (own profile only) */}
                {profile.is_own_profile && (
                    <div className="mt-6">
                        <div className="mb-1.5 flex items-center justify-between">
                            <p className="text-sm font-semibold text-tertiary">
                                Groups{groupsLoaded ? ` (${groups.length})` : ""}
                            </p>
                            <button
                                type="button"
                                onClick={() => setFormOpen({})}
                                className="text-sm text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                            >
                                Create group
                            </button>
                        </div>
                        {!groupsLoaded ? (
                            /* Reserve the space rather than showing either answer.
                               py-6 matches the empty state, so nothing jumps when the
                               real content arrives. */
                            <div className="py-6" aria-hidden="true" />
                        ) : groups.length === 0 ? (
                            <EmptyState
                                variant="grow"
                                className="min-h-0 py-6"
                                title="No groups yet"
                                description="Make one for the people you play with, and you'll be able to share spots with just them."
                                actionLabel="Create group"
                                onAction={() => setFormOpen({})}
                            />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {groups.map((g) => (
                                    <GroupCard key={g.id} group={g} onOpen={() => setOpenGroupId(g.id)} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Friends + search (own profile only) — the people you follow. */}
                {profile.is_own_profile && (
                    <div className="mt-6">
                        <p className="mb-1.5 text-sm font-semibold text-tertiary">
                            Friends ({profile.following_count})
                        </p>

                        {/* Chosen by the surface: OUTLINE on the darker page background
                            (bg-primary). The rule lives on SearchField itself now. */}
                        <SearchField
                            className="mb-4"
                            variant="outline"
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search for friends to follow..."
                        />

                        {/* Search results, or the current Following list */}
                        {isSearching ? (
                            searchLoading ? (
                                <p className="py-3 text-sm text-tertiary">Searching…</p>
                            ) : searchResults.length === 0 ? (
                                /* The dead end is the moment someone actually wants to
                                   invite: they looked for a friend and the friend is not
                                   here yet. Better than a destination they would have to
                                   remember exists. */
                                <div className="flex flex-col items-start gap-2 py-3">
                                    <p className="text-sm text-tertiary">Nobody by that name on CourtPlay yet.</p>
                                    <button
                                        type="button"
                                        onClick={() => setInviteOpen(true)}
                                        className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                                    >
                                        Invite them to CourtPlay
                                    </button>
                                </div>
                            ) : (
                                /* Search results sit where the Following list does, so they
                                   take the same card treatment — otherwise typing changes
                                   the shape of the section, not just its contents. */
                                <div className="flex flex-col gap-2">
                                    {searchResults.map((su) => (
                                        <div
                                            key={su.id}
                                            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5"
                                        >
                                            <Link to={`/profile/${su.id}`}>
                                                <RowAvatar photo={su.photo_url} name={su.first_name} />
                                            </Link>
                                            <Link
                                                to={`/profile/${su.id}`}
                                                className="min-w-0 flex-1 truncate text-sm text-secondary hover:underline"
                                            >
                                                {rowName(su.first_name, su.last_name, su.skill_level)}
                                            </Link>
                                            {su.is_following ? (
                                                <span className="shrink-0 text-sm text-tertiary">Following</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleFollow(su.id)}
                                                    className="shrink-0 text-sm text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
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
                            /* Followed players are cards, not bare rows (588:6254) — the
                               same surface the group cards use, so the two lists read as
                               one system rather than two. */
                            <div className="flex flex-col gap-2">
                                {profile.following_list.map((fu) => (
                                    <div
                                        key={fu.id}
                                        className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5"
                                    >
                                        <Link to={`/profile/${fu.id}`}>
                                            <RowAvatar photo={fu.photo_url} name={fu.first_name} />
                                        </Link>
                                        <Link
                                            to={`/profile/${fu.id}`}
                                            className="min-w-0 flex-1 truncate text-sm text-secondary hover:underline"
                                        >
                                            {rowName(fu.first_name, fu.last_name, fu.skill_level)}
                                        </Link>
                                        <button
                                            onClick={() => handleUnfollow(fu.id)}
                                            className="shrink-0 text-sm text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                                        >
                                            Unfollow
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer (own profile only): the feedback entry point sits to the left of
                    the build stamp, dot-separated in the post-detail style. The stamp makes
                    "which build am I on?" readable from the device. */}
                {profile.is_own_profile && (
                    <div className="mt-8 flex flex-col items-center gap-3">
                        <p className="flex items-center justify-center gap-1.5 text-xs text-quaternary">
                            <button
                                type="button"
                                onClick={() => setShowFeedback(true)}
                                className="font-medium text-tertiary transition duration-100 ease-linear hover:text-secondary"
                            >
                                Submit Feedback
                            </button>
                            <span aria-hidden="true">·</span>
                            {/* Kept deliberately: this is how you tell which bundle a
                                given device is actually running. No longer a button —
                                it used to reveal the PushDebug panel, now removed. */}
                            <span>Version {__BUILD_ID__}</span>
                        </p>
                    </div>
                )}
            </div>

            {showReportModal && profile && (
                <ReportUserSheet targetId={profile.id} onClose={() => setShowReportModal(false)} />
            )}

            {showFeedback && <FeedbackSheet onClose={() => setShowFeedback(false)} />}


            {openGroupId && (
                <GroupDetailSheet
                    groupId={openGroupId}
                    // Paint from the row the list already loaded rather than
                    // spinning through another get_group round trip.
                    initialGroup={groups.find((g) => g.id === openGroupId)}
                    onClose={() => setOpenGroupId(null)}
                    onChanged={fetchGroups}
                    onEdit={(g) => {
                        setOpenGroupId(null);
                        setFormOpen({ groupId: g.id });
                    }}
                />
            )}

            {formOpen && (
                <GroupFormSheet
                    groupId={formOpen.groupId}
                    onClose={() => setFormOpen(null)}
                    onSaved={() => {
                        // Saving returns to Profile — both the form and the sheet
                        // behind it close. Reopening the group afterwards used to
                        // make sense when members were added from the sheet; they
                        // are added in this form now, so it only put a sheet in
                        // the way of the list you wanted to see.
                        setFormOpen(null);
                        setOpenGroupId(null);
                        fetchGroups();
                    }}
                />
            )}
            {inviteOpen && (
                <InvitePlayerSheet
                    initialEmail={searchQuery.includes("@") ? searchQuery.trim() : ""}
                    onClose={() => setInviteOpen(false)}
                />
            )}
        </AppLayout>
    );
}
