import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { DotsVertical, Share07 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { supabase } from "@/lib/supabase";
import { useShare } from "@/hooks/use-share";
import { cx } from "@/utils/cx";
import { ClaimModal } from "./claim-modal";
import { ReportModal } from "./report-modal";
import { ShareModal } from "./share-modal";
import type { FeedPost } from "@/types/feed";

const FORMAT_CONFIG: Record<string, { label: string; color: "brand" | "blue" | "purple" | "success" | "gray" | "indigo" }> = {
    point_play: { label: "Point play", color: "brand" },
    clinic: { label: "Clinic", color: "blue" },
    lesson: { label: "Lesson", color: "indigo" },
    round_robin: { label: "Round robin", color: "success" },
    other: { label: "Other", color: "gray" },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

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

function getTimePressure(
    gameDate: string | null,
    gameTime: string | null,
): { label: string; color: "success" | "warning" | "error" } | null {
    if (!gameDate || !gameTime) return null;
    const gameDateTime = new Date(`${gameDate}T${gameTime}`);
    const hoursUntil = (gameDateTime.getTime() - Date.now()) / 3600000;
    if (hoursUntil <= 0 || hoursUntil >= 24) return null;
    const label = `Game in ${Math.floor(hoursUntil)}h`;
    if (hoursUntil > 12) return { label, color: "success" };
    if (hoursUntil > 4) return { label, color: "warning" };
    return { label, color: "error" };
}

interface SubCardProps {
    post: FeedPost;
    currentUserId?: string | null;
    onViewed?: (postId: string) => void;
    onRefresh?: () => void;
}

export const SubCard = memo(function SubCard({ post, currentUserId, onViewed, onRefresh }: SubCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const didTrack = useRef(false);

    const [showClaimModal, setShowClaimModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [claimStatus, setClaimStatus] = useState(post.user_claim_status);
    const [notifyMeState, setNotifyMeState] = useState<"idle" | "loading" | "done">(
        post.user_notify_me ? "done" : "idle",
    );
    const menuRef = useRef<HTMLDivElement>(null);

    const { shareData, handleShare, closeShareModal } = useShare();

    // Sync claim status if feed refreshes
    useEffect(() => {
        setClaimStatus(post.user_claim_status);
    }, [post.user_claim_status]);

    useEffect(() => {
        setNotifyMeState(post.user_notify_me ? "done" : "idle");
    }, [post.user_notify_me]);

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

    const handleClaimSuccess = useCallback((claimId: string) => {
        setShowClaimModal(false);
        setClaimStatus("pending");
        onRefresh?.();
        void claimId; // will be used in Phase 7 for notifications
    }, [onRefresh]);

    const handleNotifyMe = useCallback(async () => {
        if (notifyMeState !== "idle") return;
        setNotifyMeState("loading");
        await supabase.rpc("add_notify_me", { p_post_id: post.id });
        setNotifyMeState("done");
    }, [post.id, notifyMeState]);

    const formatConfig = FORMAT_CONFIG[post.format ?? ""] ?? FORMAT_CONFIG.other;
    const timePressure = getTimePressure(post.game_date, post.game_time);
    const spotsAvailable = post.spots_available;
    const isAllFilled = spotsAvailable === 0;
    const isLowAvailability = spotsAvailable === 1 && !isAllFilled;
    const isDiscounted = post.original_cost != null && post.cost != null && post.original_cost > post.cost;
    const isOwnPost = currentUserId === post.author_id;

    // Claim button / status logic
    const activeClaim = claimStatus === "pending" || claimStatus === "approved";
    const showClaimButton = !isOwnPost && !activeClaim && !isAllFilled;
    const showNotifyMe = !isOwnPost && !activeClaim && isAllFilled;

    return (
        <>
            <div ref={cardRef} className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                {/* Row 1: badges + time ago + menu */}
                <div className="flex items-center gap-1.5">
                    <Badge color={formatConfig.color} size="sm" type="pill-color">
                        {formatConfig.label}
                    </Badge>
                    {post.is_friend && (
                        <Badge color="success" size="sm" type="pill-color">
                            Friend
                        </Badge>
                    )}
                    {claimStatus === "pending" && (
                        <Badge color="warning" size="sm" type="pill-color">
                            Pending
                        </Badge>
                    )}
                    {claimStatus === "approved" && (
                        <Badge color="success" size="sm" type="pill-color">
                            Approved
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

                {/* Row 2: date + time */}
                <p className="mt-3 text-base font-semibold text-primary">
                    {post.game_date ? formatDate(post.game_date) : "Date TBD"}
                    {post.game_time && (
                        <span className="font-normal text-secondary"> · {formatTime(post.game_time)}</span>
                    )}
                </p>

                {/* Row 3: skill + player count */}
                <div className="mt-1 flex items-center gap-1.5 text-sm text-secondary">
                    {post.skill_level && <span>{post.skill_level} NTRP</span>}
                    {post.skill_level && post.total_players && <span className="text-tertiary">·</span>}
                    {post.total_players && <span>{post.total_players} players</span>}
                </div>

                {/* Row 4: location */}
                {(post.location || post.custom_court) && (
                    <p className="mt-1 text-sm text-tertiary">
                        {post.location ?? post.custom_court}
                    </p>
                )}

                <hr className="my-3 border-secondary" />

                {/* Row 5: poster + cost */}
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
                    <Link to={`/profile/${post.author_id}`} className="text-sm text-secondary hover:underline">
                        {post.first_name}
                    </Link>

                    <div className="ml-auto shrink-0 text-right">
                        {isDiscounted ? (
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm text-tertiary line-through">
                                    ${post.original_cost!.toFixed(2)}
                                </span>
                                <span className="text-sm font-semibold text-success-primary">
                                    ${post.cost!.toFixed(2)}
                                </span>
                            </div>
                        ) : post.cost != null ? (
                            <span className="text-sm font-semibold text-primary">${post.cost.toFixed(2)}</span>
                        ) : (
                            <span className="text-sm text-tertiary">Free</span>
                        )}
                    </div>
                </div>

                {/* Row 6: spots + time pressure */}
                <div className="mt-2.5 flex items-center justify-between">
                    <span
                        className={cx(
                            "text-sm font-medium",
                            isAllFilled && "text-tertiary",
                            isLowAvailability && "text-warning-primary",
                            !isAllFilled && !isLowAvailability && "text-secondary",
                        )}
                    >
                        {isAllFilled
                            ? "All spots filled"
                            : `${spotsAvailable}/${post.spots_total} spots available`}
                    </span>
                    {timePressure && (
                        <span
                            className={cx(
                                "text-xs font-semibold",
                                timePressure.color === "success" && "text-success-primary",
                                timePressure.color === "warning" && "text-warning-primary",
                                timePressure.color === "error" && "text-error-primary",
                            )}
                        >
                            {timePressure.label}
                        </span>
                    )}
                </div>

                {/* Row 7: actions */}
                <div className="mt-3 flex items-center gap-2">
                    {showNotifyMe ? (
                        notifyMeState === "done" ? (
                            <span className="text-sm text-success-primary">
                                We'll notify you if a spot opens up.
                            </span>
                        ) : (
                            <button
                                className="text-sm text-brand-secondary underline underline-offset-2 disabled:opacity-50"
                                onClick={handleNotifyMe}
                                disabled={notifyMeState === "loading"}
                            >
                                Notify me if this opens up
                            </button>
                        )
                    ) : showClaimButton ? (
                        <Button
                            color="primary"
                            size="sm"
                            className="flex-1"
                            onClick={() => setShowClaimModal(true)}
                        >
                            Claim spot
                        </Button>
                    ) : activeClaim ? (
                        <span className="text-sm text-tertiary">
                            {claimStatus === "pending"
                                ? "Awaiting poster approval"
                                : "Spot approved — check My Activity for details"}
                        </span>
                    ) : isOwnPost ? (
                        <span className="text-sm text-tertiary">Your post</span>
                    ) : null}

                    <button
                        className="ml-auto rounded p-1.5 text-quaternary hover:text-tertiary"
                        aria-label="Share"
                        onClick={() => handleShare(post)}
                    >
                        <Share07 className="size-4" />
                    </button>
                </div>

                {/* View count */}
                <p className="mt-1.5 text-right text-xs text-quaternary">
                    {post.view_count} {post.view_count === 1 ? "view" : "views"}
                </p>
            </div>

            {showClaimModal && (
                <ClaimModal
                    post={post}
                    onClose={() => setShowClaimModal(false)}
                    onSuccess={handleClaimSuccess}
                />
            )}

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
