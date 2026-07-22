import { Avatar } from "@/components/base/avatar/avatar";
import type { ClaimMessage } from "@/types/activity";

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/** One reply in a claim thread — indented under the original message (design 274-4741). */
export function ThreadMessage({ msg }: { msg: ClaimMessage }) {
    const name = msg.last_name ? `${msg.first_name} ${msg.last_name.charAt(0).toUpperCase()}.` : msg.first_name;
    return (
        <div className="flex flex-col gap-4 pl-8">
            <div className="flex items-center gap-2">
                <Avatar
                    size="xs"
                    src={msg.photo_url}
                    alt={msg.first_name}
                    initials={msg.first_name.charAt(0).toUpperCase()}
                    className="shrink-0 bg-white p-px shadow-xs"
                />
                <span className="truncate text-xs text-tertiary">
                    {name} · {timeAgo(msg.created_at)}
                </span>
            </div>
            <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                <p className="text-sm text-secondary">“{msg.body}”</p>
            </div>
        </div>
    );
}
