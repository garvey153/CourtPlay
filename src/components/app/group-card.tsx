import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { DotsVertical } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { useShare } from "@/hooks/use-share";
import { cx } from "@/utils/cx";
import { ReportModal } from "./report-modal";
import { ShareModal } from "./share-modal";
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
}

export const GroupCard = memo(function GroupCard({ post, currentUserId, onViewed }: GroupCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const didTrack = useRef(false);
    const { shareData, handleShare, closeShareModal } = useShare();
    const [showMenu, setShowMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Close menu on click outside
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showMenu]);

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
    const isOwnPost = currentUserId === post.author_id;
    const canReport = !!currentUserId && !isOwnPost;

    const title = ["Tennis, Regular Play", post.skill_level ? `NTRP ${post.skill_level}` : null]
        .filter(Boolean)
        .join(" · ");
    const schedule = [post.preferred_days?.join(", "), post.preferred_times?.join(" / ")]
        .filter(Boolean)
        .join(" · ");

    return (
        <>
            <div ref={cardRef} className="flex w-full overflow-hidden rounded text-left">
                {/* Left accent bar — blue for regular play, gradient when featured (pro/club) */}
                <span
                    className={cx(
                        "w-1 shrink-0 self-stretch",
                        isFeatured ? "bg-gradient-to-b from-brand-500 to-blue-400" : "bg-blue-500",
                    )}
                    aria-hidden="true"
                />

                {/* Card body */}
                <div className="flex min-w-0 flex-1 flex-col gap-3 bg-secondary p-4">
                    {/* Poster row: avatar + name/time (+ friend) + menu */}
                    <div className="flex w-full items-center justify-between gap-3 pt-1">
                        <div className="flex min-w-0 items-center gap-2">
                            <Avatar
                                size="xs"
                                src={post.photo_url}
                                alt={post.first_name}
                                initials={post.first_name.charAt(0).toUpperCase()}
                                className="shrink-0 bg-white p-px shadow-xs"
                            />
                            <span className="truncate text-xs text-tertiary">
                                <Link
                                    to={`/profile/${post.author_id}`}
                                    className="font-medium text-tertiary hover:text-secondary hover:underline"
                                >
                                    {post.first_name}
                                    {post.last_name ? ` ${post.last_name.charAt(0).toUpperCase()}.` : ""}
                                </Link>
                                {" · "}
                                {timeAgo(post.created_at)}
                            </span>
                            {post.is_friend && (
                                <span className="shrink-0 rounded-lg bg-blue-900 px-2 py-0.5 text-xs font-semibold text-blue-400">
                                    Friend
                                </span>
                            )}
                        </div>

                        {canReport && (
                            <div className="relative shrink-0" ref={menuRef}>
                                <button
                                    type="button"
                                    className="rounded p-0.5 text-quaternary hover:text-tertiary"
                                    aria-label="More options"
                                    onClick={() => setShowMenu(!showMenu)}
                                >
                                    <DotsVertical className="size-4" />
                                </button>
                                {showMenu && (
                                    <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-secondary bg-primary py-1 shadow-lg">
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2 text-left text-sm text-secondary hover:bg-secondary"
                                            onClick={() => {
                                                setShowMenu(false);
                                                handleShare(post);
                                            }}
                                        >
                                            Share this post
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2 text-left text-sm text-error-primary hover:bg-secondary"
                                            onClick={() => {
                                                setShowMenu(false);
                                                setShowReportModal(true);
                                            }}
                                        >
                                            Report this post
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Title + supporting info */}
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-md font-semibold text-primary">{title}</p>
                        {post.location && <p className="text-xs text-secondary">{post.location}</p>}
                        {schedule && <p className="text-xs text-tertiary">{schedule}</p>}
                    </div>

                    {/* Notes speech-bubble (only when the poster added a note) */}
                    {post.notes && (
                        <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                            <p className="text-sm text-secondary">“{post.notes}”</p>
                        </div>
                    )}
                </div>
            </div>

            {shareData && <ShareModal url={shareData.url} text={shareData.text} onClose={closeShareModal} />}

            {showReportModal && (
                <ReportModal targetType="post" targetId={post.id} onClose={() => setShowReportModal(false)} />
            )}
        </>
    );
});
