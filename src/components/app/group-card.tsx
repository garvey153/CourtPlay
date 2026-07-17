import { memo, useEffect, useRef } from "react";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import type { FeedPost } from "@/types/feed";

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

interface GroupCardProps {
    post: FeedPost;
    /** Whether the viewing user has a complete profile (headline/photo + skill level). */
    profileComplete: boolean;
    currentUserId?: string | null;
    onViewed?: (postId: string) => void;
    /** Tapping the card opens the regular-play detail bottom sheet. */
    onOpenDetail?: (post: FeedPost) => void;
}

export const GroupCard = memo(function GroupCard({ post, currentUserId, onViewed, onOpenDetail }: GroupCardProps) {
    const cardRef = useRef<HTMLButtonElement>(null);
    const didTrack = useRef(false);

    useEffect(() => {
        const el = cardRef.current;
        // Do not track views for the author's own posts
        if (!el || didTrack.current || currentUserId === post.author_id) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !didTrack.current) {
                    didTrack.current = true;
                    onViewed?.(post.id);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [post.id, post.author_id, currentUserId, onViewed]);

    // Pro/club authors get the "featured" gradient accent bar; players get solid blue.
    const isFeatured = post.author_type === "pro" || post.author_type === "club";

    const title = ["Tennis, Regular Play", post.skill_level ? `NTRP ${post.skill_level}` : null]
        .filter(Boolean)
        .join(" · ");
    const schedule = [post.preferred_days?.join(", "), post.preferred_times?.join(" / ")]
        .filter(Boolean)
        .join(" · ");

    return (
        <button
            ref={cardRef}
            type="button"
            onClick={() => onOpenDetail?.(post)}
            className="flex w-full overflow-hidden rounded text-left"
        >
            {/* Left accent bar — blue for regular play, gradient when featured (pro/club) */}
            <span
                className={cx(
                    "w-1 shrink-0 self-stretch",
                    isFeatured ? "bg-gradient-to-b from-brand-500 to-blue-400" : "bg-blue-500",
                )}
                aria-hidden="true"
            />

            {/* Card body — title-first layout, matching the green (sub) card */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                {/* Title + supporting info */}
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-md font-semibold text-primary">{title}</p>
                    {post.location && <p className="text-xs text-secondary">{post.location}</p>}
                    {schedule && <p className="text-xs text-tertiary">{schedule}</p>}
                </div>

                {/* Poster row: avatar + name/time (+ friend) */}
                <div className="flex min-w-0 items-center gap-2 pt-1">
                    <Avatar
                        size="xs"
                        src={post.photo_url}
                        alt={post.first_name}
                        initials={post.first_name.charAt(0).toUpperCase()}
                        className="shrink-0 bg-white p-px shadow-xs"
                    />
                    <span className="truncate text-xs text-tertiary">
                        <span className="font-medium">
                            {post.first_name}
                            {post.last_name ? ` ${post.last_name.charAt(0).toUpperCase()}.` : ""}
                        </span>
                        {" · "}
                        {timeAgo(post.created_at)}
                    </span>
                    {post.is_friend && (
                        <span className="shrink-0 rounded-lg bg-blue-900 px-2 py-0.5 text-xs font-semibold text-blue-400">
                            Friend
                        </span>
                    )}
                </div>

                {/* Notes speech-bubble (only when the poster added a note) */}
                {post.notes && (
                    <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}
            </div>
        </button>
    );
});
