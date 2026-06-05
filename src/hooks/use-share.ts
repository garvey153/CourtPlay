import { useCallback, useState } from "react";
import type { FeedPost } from "@/types/feed";

const FORMAT_LABELS: Record<string, string> = {
    point_play: "Point play",
    clinic: "Clinic",
    lesson: "Lesson",
    round_robin: "Round robin",
    other: "Other",
};

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

export function buildShareData(post: FeedPost) {
    const url = `${window.location.origin}/post/${post.id}`;
    const skill = post.skill_level ? `${post.skill_level} NTRP` : "";
    const location = post.location ?? post.custom_court ?? "";
    const date = post.game_date ? formatDate(post.game_date) : "";
    const time = post.game_time ? formatTime(post.game_time) : "";
    const cost = post.cost != null ? `$${post.cost.toFixed(2)}` : "Free";
    const format = FORMAT_LABELS[post.format ?? ""] ?? "tennis";

    const text = [
        `${post.first_name} needs a ${skill} ${format} sub`,
        location ? `at ${location}` : "",
        date ? `on ${date}` : "",
        time ? `at ${time}` : "",
        cost !== "Free" ? cost : "",
        "Claim it on CourtPlay:",
    ].filter(Boolean).join(" ");

    return { url, text, title: `${format} sub needed — CourtPlay` };
}

export function useShare() {
    const [shareData, setShareData] = useState<{ url: string; text: string } | null>(null);

    const handleShare = useCallback(async (post: FeedPost) => {
        const data = buildShareData(post);

        // Try native Web Share API first (iOS Safari, Android)
        if (navigator.share) {
            try {
                await navigator.share({ title: data.title, text: data.text, url: data.url });
                return;
            } catch {
                // User cancelled or API failed — fall through to modal
            }
        }

        // Fallback: show share modal
        setShareData({ url: data.url, text: data.text });
    }, []);

    const closeShareModal = useCallback(() => {
        setShareData(null);
    }, []);

    return { shareData, handleShare, closeShareModal };
}
