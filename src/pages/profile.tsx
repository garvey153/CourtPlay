import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, DotsVertical, SearchLg } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ReportModal } from "@/components/app/report-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Types ──────────────────────────────────────────────────────────────────

interface ProfilePost {
    id: string;
    post_type: string;
    format: string | null;
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

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

const FORMAT_LABELS: Record<string, string> = {
    point_play: "Point play", clinic: "Clinic", lesson: "Lesson",
    round_robin: "Round robin", other: "Other",
};

// ── Component ──────────────────────────────────────────────────────────────

export function Profile() {
    const { id } = useParams<{ id: string }>();
    const { user, loading: authLoading } = useAuth();
    const profileId = (!id || id === "me") ? user?.id : id;

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followLoading] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Search state (own profile only)
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Unfollow confirmation
    const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

    // Invite state
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteConfirmEmail, setInviteConfirmEmail] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

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

    // Search users
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
        setSearchLoading(true);
        const timer = setTimeout(async () => {
            const { data } = await supabase.rpc("search_users", { p_query: searchQuery.trim() });
            setSearchResults((data as SearchUser[]) ?? []);
            setShowDropdown(true);
            setSearchLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSendInvite = async () => {
        if (!EMAIL_RE.test(inviteEmail)) return;
        setInviteSending(true);
        await supabase.from("invites").insert({ email: inviteEmail, invited_by: user?.id });
        setInviteConfirmEmail(inviteEmail);
        setInviteEmail("");
        setInviteSending(false);
        setTimeout(() => setInviteConfirmEmail(null), 4000);
    };

    const handleFollow = useCallback(async (targetId: string) => {
        // Optimistic: update UI immediately
        setSearchResults((prev) =>
            prev.map((u) => u.id === targetId ? { ...u, is_following: true } : u),
        );
        if (targetId === profileId && profile) {
            setProfile((p) => p ? { ...p, is_following: true, follower_count: p.follower_count + 1 } : p);
        }

        const { error: rpcError } = await supabase.rpc("follow_user", { p_following_id: targetId });

        if (rpcError) {
            // Revert on failure
            setSearchResults((prev) =>
                prev.map((u) => u.id === targetId ? { ...u, is_following: false } : u),
            );
            if (targetId === profileId) fetchProfile();
        }
    }, [profileId, profile, fetchProfile]);

    const handleUnfollow = useCallback(async (targetId: string) => {
        // Optimistic: update UI immediately
        setSearchResults((prev) =>
            prev.map((u) => u.id === targetId ? { ...u, is_following: false } : u),
        );
        if (targetId === profileId && profile) {
            setProfile((p) => p ? { ...p, is_following: false, follower_count: Math.max(0, p.follower_count - 1) } : p);
        }
        setUnfollowingId(null);

        const { error: rpcError } = await supabase.rpc("unfollow_user", { p_following_id: targetId });

        if (rpcError) {
            // Revert on failure
            setSearchResults((prev) =>
                prev.map((u) => u.id === targetId ? { ...u, is_following: true } : u),
            );
            if (targetId === profileId) fetchProfile();
        }
    }, [profileId, profile, fetchProfile]);

    const handleFollowToggle = useCallback(async () => {
        if (!profile) return;
        if (profile.is_following) {
            setUnfollowingId(profile.id);
        } else {
            await handleFollow(profile.id);
        }
    }, [profile, handleFollow]);

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

    return (
        <AppLayout>
            <div className="px-4 py-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                    {profile.photo_url ? (
                        <img
                            src={profile.photo_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="size-16 shrink-0 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-tertiary text-xl font-semibold text-secondary">
                            {profile.first_name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-lg font-semibold text-primary">
                                {profile.first_name} {profile.last_name}
                            </h1>
                            {profile.new_to_westport && (
                                <Badge color="blue" size="sm" type="pill-color">New to Westport</Badge>
                            )}
                        </div>
                        {profile.headline && (
                            <p className="mt-0.5 text-sm text-tertiary">{profile.headline}</p>
                        )}
                        {profile.skill_level && (
                            <p className="mt-0.5 text-sm font-medium text-secondary">{profile.skill_level} NTRP</p>
                        )}
                    </div>

                    {/* Menu for non-own profiles */}
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

                {/* Stats */}
                <div className="mt-4 flex gap-6">
                    <div className="text-center">
                        <p className="text-base font-semibold text-primary">{profile.follower_count}</p>
                        <p className="text-xs text-tertiary">Followers</p>
                    </div>
                    <div className="text-center">
                        <p className="text-base font-semibold text-primary">{profile.following_count}</p>
                        <p className="text-xs text-tertiary">Following</p>
                    </div>
                </div>

                {/* Settings link (own profile only) */}
                {profile.is_own_profile && (
                    <Link
                        to="/settings"
                        className="mt-4 block text-sm font-medium text-brand-secondary hover:text-brand-secondary_hover"
                    >
                        Notification settings
                    </Link>
                )}

                {/* Follow/Unfollow button */}
                {!profile.is_own_profile && (
                    <div className="mt-4">
                        {unfollowingId === profile.id ? (
                            <div className="flex items-center gap-2">
                                <span className="flex-1 text-sm text-secondary">Unfollow {profile.first_name}?</span>
                                <Button
                                    color="primary-destructive"
                                    size="sm"
                                    onClick={() => handleUnfollow(profile.id)}
                                    isLoading={followLoading}
                                >
                                    Unfollow
                                </Button>
                                <Button
                                    color="secondary"
                                    size="sm"
                                    onClick={() => setUnfollowingId(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button
                                color={profile.is_following ? "secondary" : "primary"}
                                size="sm"
                                className="w-full"
                                onClick={handleFollowToggle}
                                isLoading={followLoading}
                            >
                                {profile.is_following ? "Following" : "Follow"}
                            </Button>
                        )}
                    </div>
                )}

                {/* Court preferences */}
                {profile.court_preferences && profile.court_preferences.length > 0 && (
                    <div className="mt-4">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-tertiary">Courts</p>
                        <div className="flex flex-wrap gap-1.5">
                            {profile.court_preferences.map((court) => (
                                <Badge key={court} color="gray" size="sm" type="color">
                                    {court}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                <hr className="my-5 border-secondary" />

                {/* Active posts */}
                <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-tertiary">
                        Active posts ({profile.active_posts.length})
                    </p>
                    {profile.active_posts.length === 0 ? (
                        <p className="text-sm text-tertiary">No active posts.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {profile.active_posts.map((post) => (
                                <li key={post.id}>
                                    <Link
                                        to={`/post/${post.id}`}
                                        className="block rounded-lg border border-secondary bg-primary p-3 hover:bg-primary_hover"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Badge color="brand" size="sm" type="pill-color">
                                                {FORMAT_LABELS[post.format ?? ""] ?? "Sub needed"}
                                            </Badge>
                                            {post.game_date && (
                                                <span className="text-xs text-secondary">
                                                    {formatDate(post.game_date)}
                                                    {post.game_time && ` · ${formatTime(post.game_time)}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-xs text-tertiary">
                                            <span>{post.location ?? post.custom_court}</span>
                                            <span>
                                                {post.spots_available}/{post.spots_total} open
                                                {post.cost != null && ` · $${post.cost.toFixed(2)}`}
                                            </span>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Following list (visible to all signed-in users) */}
                {profile.following_list.length > 0 && (
                    <>
                        <hr className="my-5 border-secondary" />
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-tertiary">
                                Following ({profile.following_list.length})
                            </p>
                            <ul className="flex flex-col gap-1">
                                {profile.following_list.map((fu) => (
                                    <li key={fu.id}>
                                        <Link
                                            to={`/profile/${fu.id}`}
                                            className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-primary_hover"
                                        >
                                            {fu.photo_url ? (
                                                <img
                                                    src={fu.photo_url}
                                                    alt=""
                                                    referrerPolicy="no-referrer"
                                                    className="size-7 shrink-0 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-secondary">
                                                    {fu.first_name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-sm text-primary">{fu.first_name} {fu.last_name}</span>
                                            {fu.skill_level && (
                                                <span className="text-xs text-tertiary">{fu.skill_level} NTRP</span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {/* Find friends (own profile only) */}
                {profile.is_own_profile && (
                    <>
                        <hr className="my-5 border-secondary" />
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-tertiary">
                                Find friends
                            </p>

                            {/* Invite confirmation banner */}
                            {inviteConfirmEmail && (
                                <div className="mb-3 flex items-center gap-2 rounded-lg bg-success-secondary px-3 py-2.5">
                                    <Check className="size-4 shrink-0 text-success-primary" aria-hidden="true" />
                                    <p className="text-sm text-success-primary">
                                        Invite sent to <span className="font-medium">{inviteConfirmEmail}</span>
                                    </p>
                                </div>
                            )}

                            {showInvite ? (
                                /* ── Invite view ── */
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm text-secondary">Enter an email to invite a new player to CourtPlay.</p>
                                    <Input
                                        label="Email address"
                                        type="email"
                                        placeholder="friend@example.com"
                                        value={inviteEmail}
                                        onChange={(v) => setInviteEmail(v)}
                                        isInvalid={inviteEmail.length > 0 && !EMAIL_RE.test(inviteEmail)}
                                        hint={inviteEmail.length > 0 && !EMAIL_RE.test(inviteEmail) ? "Enter a valid email" : undefined}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            color="primary"
                                            size="sm"
                                            className="flex-1"
                                            isDisabled={!EMAIL_RE.test(inviteEmail)}
                                            isLoading={inviteSending}
                                            showTextWhileLoading
                                            onClick={handleSendInvite}
                                        >
                                            Send invite
                                        </Button>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            onClick={() => { setShowInvite(false); setInviteEmail(""); }}
                                        >
                                            Back to search
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                /* ── Search view ── */
                                <div className="relative" ref={searchContainerRef}>
                                    <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2.5 ring-1 ring-inset ring-primary focus-within:ring-2 focus-within:ring-brand">
                                        <SearchLg className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                        <input
                                            className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-placeholder"
                                            placeholder="Search by name…"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onFocus={() => searchQuery.trim().length >= 2 && setShowDropdown(true)}
                                            autoComplete="off"
                                        />
                                    </div>

                                    {/* Results dropdown */}
                                    {showDropdown && (
                                        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-secondary bg-primary shadow-lg">
                                            {searchLoading ? (
                                                <p className="px-4 py-3 text-sm text-tertiary">Searching…</p>
                                            ) : searchResults.length === 0 ? (
                                                <p className="px-4 py-3 text-sm text-tertiary">No players found</p>
                                            ) : (
                                                <ul>
                                                    {searchResults.map((su) => (
                                                        <li key={su.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary">
                                                            {su.photo_url ? (
                                                                <img src={su.photo_url} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary text-sm font-medium text-secondary">
                                                                    {su.first_name.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <Link to={`/profile/${su.id}`} className="text-sm font-medium text-primary hover:underline">
                                                                    {su.first_name} {su.last_name}
                                                                </Link>
                                                                <div className="flex items-center gap-1.5">
                                                                    {su.skill_level && <span className="text-xs text-tertiary">{su.skill_level} NTRP</span>}
                                                                    {su.new_to_westport && <Badge color="blue" size="sm" type="pill-color">New</Badge>}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="xs"
                                                                color={su.is_following ? "secondary" : "primary"}
                                                                isDisabled={su.is_following}
                                                                onClick={() => su.is_following ? undefined : handleFollow(su.id)}
                                                            >
                                                                {su.is_following ? "Following" : "Follow"}
                                                            </Button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            <div className="border-t border-secondary">
                                                <button
                                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-brand-secondary hover:bg-secondary"
                                                    onMouseDown={() => { setShowDropdown(false); setShowInvite(true); }}
                                                >
                                                    Invite new player &rarr;
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {showReportModal && profile && (
                <ReportModal
                    targetType="user"
                    targetId={profile.id}
                    onClose={() => setShowReportModal(false)}
                />
            )}
        </AppLayout>
    );
}
