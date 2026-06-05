import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { DotsVertical, Share07 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
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

export const GroupCard = memo(function GroupCard({ post, profileComplete, currentUserId, onViewed }: GroupCardProps) {
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

    return (
        <>
        <div ref={cardRef} className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
            {/* Row 1: label + time ago + menu */}
            <div className="flex items-center gap-1.5">
                <Badge color="gray" size="sm" type="pill-color">
                    Regular game
                </Badge>
                {post.is_friend && (
                    <Badge color="success" size="sm" type="pill-color">
                        Friend
                    </Badge>
                )}
                <span className="ml-auto shrink-0 text-xs text-tertiary">{timeAgo(post.created_at)}</span>
                {currentUserId && currentUserId !== post.author_id && (
                    <div className="relative" ref={menuRef}>
                        <button
                            className="rounded p-0.5 text-quaternary hover:text-tertiary"
                            aria-label="More options"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <DotsVertical className="size-4" />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-secondary bg-primary py-1 shadow-lg">
                                <button
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

            {/* Skill level */}
            {post.skill_level && (
                <p className="mt-3 text-base font-semibold text-primary">{post.skill_level} NTRP</p>
            )}

            {/* Preferred days + times */}
            {((post.preferred_days?.length ?? 0) > 0 || (post.preferred_times?.length ?? 0) > 0) && (
                <p className="mt-1 text-sm text-secondary">
                    {[post.preferred_days?.join(", "), post.preferred_times?.join(" / ")]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
            )}

            {/* Preferred courts / location */}
            {post.location && (
                <p className="mt-1 text-sm text-tertiary">{post.location}</p>
            )}

            {/* Format interest chips */}
            {post.format && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge color="gray" size="sm" type="color">
                        {post.format.replace(/_/g, " ")}
                    </Badge>
                </div>
            )}

            {/* Notes */}
            {post.notes && (
                <p className="mt-3 text-sm italic text-secondary">"{post.notes}"</p>
            )}

            <hr className="my-3 border-secondary" />

            {/* Poster */}
            <div className="flex items-center gap-2">
                {post.photo_url ? (
                    <img
                        src={post.photo_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-7 shrink-0 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-secondary">
                        {post.first_name.charAt(0).toUpperCase()}
                    </div>
                )}
                <Link to={`/profile/${post.author_id}`} className="text-sm font-medium text-primary hover:underline">
                    {post.first_name} {post.last_name}
                </Link>
                <button
                    className="ml-auto rounded p-1.5 text-quaternary hover:text-tertiary"
                    aria-label="Share"
                    onClick={() => handleShare(post)}
                >
                    <Share07 className="size-4" />
                </button>
            </div>

            {/* Contact info — gated behind complete profile */}
            {profileComplete ? (
                <div className={cx("mt-2 flex flex-col gap-0.5 text-sm text-secondary")}>
                    <span>{post.author_id}</span>
                    {/* Phone/email shown post-Phase 4 when claim is approved */}
                    <span className="text-xs text-tertiary">
                        Contact details shared after connecting
                    </span>
                </div>
            ) : (
                <p className="mt-2 text-xs text-tertiary">
                    Complete your profile to see contact details.
                </p>
            )}
        </div>

        {shareData && (
            <ShareModal
                url={shareData.url}
                text={shareData.text}
                onClose={closeShareModal}
            />
        )}

        {showReportModal && (
            <ReportModal
                targetType="post"
                targetId={post.id}
                onClose={() => setShowReportModal(false)}
            />
        )}
        </>
    );
});
