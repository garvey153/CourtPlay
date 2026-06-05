import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { PushPrompt } from "@/components/app/push-prompt";
import { SubCard } from "@/components/app/sub-card";
import { GroupCard } from "@/components/app/group-card";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";
import type { FeedPost } from "@/types/feed";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    point_play: "Point play",
    clinic: "Clinic",
    lesson: "Lesson",
    round_robin: "Round robin",
    other: "Other",
};

export function PostDetail() {
    const { id } = useParams<{ id: string }>();
    const { user, loading: authLoading } = useAuth();
    const { profile } = useProfile();

    const [post, setPost] = useState<FeedPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPost = useCallback(async () => {
        if (!id || !UUID_RE.test(id)) {
            setNotFound(true);
            setLoading(false);
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const { data, error: rpcError } = await supabase.rpc("get_post_by_id", { p_post_id: id });

            if (rpcError || !data) {
                setNotFound(true);
            } else {
                setPost(data as FeedPost);
            }
        } catch {
            setError("Failed to load this post. Please try again.");
        }
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchPost();
    }, [fetchPost]);

    // Update OG meta tags
    useEffect(() => {
        if (notFound || !post || post.status !== "active") {
            document.title = "CourtPlay";
            setMetaTag("og:title", "CourtPlay");
            setMetaTag("og:description", "This spot is no longer available on CourtPlay.");
            setMetaTag("og:type", "website");
            return () => { document.title = "CourtPlay"; };
        }

        const formatLabel = FORMAT_LABELS[post.format ?? ""] ?? "Tennis";
        const dateStr = post.game_date ? formatDate(post.game_date) : "";
        const timeStr = post.game_time ? formatTime(post.game_time) : "";
        const location = post.location ?? post.custom_court ?? "";
        const cost = post.cost != null ? `$${post.cost.toFixed(2)}` : "Free";

        const title = `${formatLabel} sub needed${dateStr ? ` — ${dateStr}` : ""}`;
        const description = [
            post.skill_level ? `${post.skill_level} NTRP` : "",
            location,
            dateStr && timeStr ? `${dateStr} at ${timeStr}` : dateStr,
            cost,
            `${post.spots_available} spot${post.spots_available !== 1 ? "s" : ""} available`,
        ].filter(Boolean).join(" · ");

        document.title = `${title} | CourtPlay`;
        setMetaTag("og:title", title);
        setMetaTag("og:description", description);
        setMetaTag("og:url", `${window.location.origin}/post/${post.id}`);
        setMetaTag("og:type", "website");

        return () => { document.title = "CourtPlay"; };
    }, [post, notFound]);

    if (loading || authLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-primary">
                <div className="size-8 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-primary px-4 text-center">
                <p className="text-base font-semibold text-primary">Something went wrong</p>
                <p className="text-sm text-tertiary">{error}</p>
                <button
                    onClick={fetchPost}
                    className="rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Expired / deleted / not found
    if (notFound || !post || post.status !== "active") {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-primary px-4 text-center">
                <p className="text-base font-semibold text-primary">This spot is no longer available.</p>
                {user ? (
                    <Link
                        to="/feed"
                        className="text-sm font-semibold text-brand-secondary underline underline-offset-2"
                    >
                        Browse open spots &rarr;
                    </Link>
                ) : (
                    <Link
                        to="/signup"
                        className="text-sm font-semibold text-brand-secondary underline underline-offset-2"
                    >
                        Sign up to find a sub &rarr;
                    </Link>
                )}
            </div>
        );
    }

    // Authenticated — show full card with claim button
    if (user) {
        const profileComplete =
            !!profile && !!(profile.skill_level) && !!(profile.headline || profile.photo_url);

        return (
            <AppLayout>
                <div className="px-4 py-4">
                    {post.post_type === "sub_need" ? (
                        <SubCard post={post} currentUserId={user.id} />
                    ) : (
                        <GroupCard
                            post={post}
                            profileComplete={profileComplete}
                            currentUserId={user.id}
                        />
                    )}
                    {/* Push prompt after viewing a post (only if user is not the poster) */}
                    {post.author_id !== user.id && (
                        <PushPrompt variant="post_viewed" />
                    )}
                </div>
            </AppLayout>
        );
    }

    // Unauthenticated — show preview + sign-up CTA
    const formatLabel = FORMAT_LABELS[post.format ?? ""] ?? "Tennis";
    const redirectUrl = `/post/${post.id}`;

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-4 py-12">
            <div className="w-full max-w-sm">
                {/* Preview card — no poster name, avatar, view count, or claim button */}
                <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                    <Badge color="brand" size="sm" type="pill-color">
                        {formatLabel}
                    </Badge>

                    {post.game_date && (
                        <p className="mt-3 text-lg font-semibold text-primary">
                            {formatDate(post.game_date)}
                            {post.game_time && (
                                <span className="font-normal text-secondary"> · {formatTime(post.game_time)}</span>
                            )}
                        </p>
                    )}

                    {post.skill_level && (
                        <p className="mt-1 text-sm text-secondary">{post.skill_level} NTRP</p>
                    )}

                    {(post.location || post.custom_court) && (
                        <p className="mt-1 text-sm text-tertiary">{post.location ?? post.custom_court}</p>
                    )}

                    <hr className="my-3 border-secondary" />

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary">
                            {post.spots_available}/{post.spots_total} spots available
                        </span>
                        {post.cost != null ? (
                            <span className="text-sm font-semibold text-primary">${post.cost.toFixed(2)}</span>
                        ) : (
                            <span className="text-sm text-tertiary">Free</span>
                        )}
                    </div>
                </div>

                {/* CTA */}
                <Link to={`/signup?redirect=${encodeURIComponent(redirectUrl)}`}>
                    <Button color="primary" size="lg" className="mt-6 w-full">
                        Sign in to claim this spot
                    </Button>
                </Link>

                <p className="mt-4 text-center text-xs text-tertiary">
                    Already have an account?{" "}
                    <Link
                        to={`/signin?redirect=${encodeURIComponent(redirectUrl)}`}
                        className="font-semibold text-brand-secondary"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

function setMetaTag(property: string, content: string) {
    let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
    }
    el.content = content;
}
