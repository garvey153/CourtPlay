import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Users01, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { useShare } from "@/hooks/use-share";
import type { FeedPost } from "@/types/feed";
import { ShareModal } from "./share-modal";
import { ReportModal } from "./report-modal";
import { formatDuration, formatPlayType, formatWhen, timeAgo } from "./sub-card";
import { PRIMARY_MD as PRIMARY_BTN } from "@/components/base/buttons/button-styles";

interface TaggedDetailSheetProps {
    post: FeedPost;
    /** The group this sub is playing with, from get_post_by_id. */
    groupName?: string | null;
    onClose: () => void;
}

/**
 * The post sheet for someone in the group the sub will be playing with.
 *
 * A separate component from ClaimDetailSheet rather than another branch inside
 * it, because almost everything that sheet exists to do — claim, cancel, message
 * the poster, watch a claim's status — does not apply here. This viewer is
 * already in the game: the spot is not theirs to take, and the server refuses
 * their claim (submit_claim, 20260808000000). What they get instead is context
 * and a way to help fill it.
 *
 * So: no claim action, no price, no thread. Same shell, so it reads as the same
 * kind of surface.
 */
export function TaggedDetailSheet({ post, groupName, onClose }: TaggedDetailSheetProps) {
    const [showReport, setShowReport] = useState(false);
    const { shareData, handleShare, closeShareModal } = useShare();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const playType = formatPlayType(post.play_type);
    const title = [playType, "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");
    const posterName = `${post.first_name}${post.last_name ? ` ${post.last_name.charAt(0)}.` : ""}`;

    if (showReport) {
        return <ReportModal targetType="post" targetId={post.id} onClose={() => setShowReport(false)} />;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tagged-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 sheet-fill rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-3 z-10 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" strokeWidth={1} />
                </button>

                {/* pr-8 keeps the title clear of the absolutely-positioned close button. */}
                <div className="flex min-w-0 flex-col gap-1 pr-8">
                    <h2 id="tagged-sheet-title" className="text-md font-semibold text-primary">
                        {title}
                        {when && ` · ${when}`}
                    </h2>
                    {subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}
                </div>

                {/* Poster row. The two-person mark sits where the price does on the
                    claimable sheet — the same swap the feed card makes. */}
                <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                            size="xs"
                            src={post.photo_url}
                            alt={post.first_name}
                            initials={post.first_name.charAt(0).toUpperCase()}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <span className="truncate text-xs text-tertiary">
                            {posterName} · {timeAgo(post.created_at)}
                        </span>
                    </div>
                    <Users01 aria-hidden="true" className="size-5 shrink-0 text-fg-quaternary" />
                </div>

                {post.notes && (
                    <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}

                {/* Why you're seeing this, and what happens next. The group name is
                    only returned to members of that group, so it can be shown
                    plainly — but fall back rather than printing "undefined" if the
                    sheet is ever opened from data that lacks it. */}
                <p className="text-sm text-tertiary">
                    <span aria-hidden="true">* </span>
                    {posterName} tagged{" "}
                    <span className="font-semibold text-secondary">{groupName ?? "your group"}</span>
                    {groupName ? " group" : ""} on this post. You will be notified with status updates. Have an issue?{" "}
                    <button
                        type="button"
                        onClick={() => setShowReport(true)}
                        className="underline transition duration-100 ease-linear hover:text-secondary"
                    >
                        Report claim
                    </button>
                </p>

                <button type="button" onClick={() => handleShare(post)} className={PRIMARY_BTN}>
                    Share with a friend
                </button>
            </motion.div>

            {shareData && <ShareModal url={shareData.url} text={shareData.text} onClose={closeShareModal} />}
        </div>
    );
}
