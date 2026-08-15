import { cx } from "@/utils/cx";
import { KIND_CONFIG } from "@/components/app/sub-card";

/** The shared neutral badge pair — the same one Claimed uses on posts. */
const PENDING = KIND_CONFIG.pending;

export interface AdminInviteRow {
    id: string;
    email: string;
    source: "member" | "admin" | "backfill";
    sent_at: string | null;
    accepted_at: string | null;
    accepted_user_id: string | null;
    /** Null for a seeded row — nobody invited them, you did. */
    inviter_name: string | null;
    /** Who actually took the invite up, which need not be who was invited. */
    accepted_name: string | null;
}

function when(value: string | null): string {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * One invite. The left bar carries the state, matching the other admin cards:
 * green for someone who joined, neutral for one still outstanding.
 *
 * Both states are badged. An outstanding invite used to show no badge at all,
 * which made "waiting" and "joined" hard to tell apart at a glance — and since
 * the detail sheet only offers Remove while an invite is outstanding, a row that
 * read as joined looked like one that could not be revoked.
 *
 * Pending borrows KIND_CONFIG.pending's colours (the same neutral pair as
 * Claimed) so it matches the badge language used on posts.
 */
export function AdminInviteCard({ invite, onOpen }: { invite: AdminInviteRow; onOpen: () => void }) {
    const joined = !!invite.accepted_at;
    const origin =
        invite.source === "backfill"
            ? "Founding member"
            : invite.inviter_name
              ? `Invited by ${invite.inviter_name}`
              : "Sent by admin";

    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex w-full overflow-hidden rounded-lg bg-secondary text-left transition duration-100 ease-linear hover:bg-secondary_hover"
        >
            <div className={cx("w-1 shrink-0", joined ? "bg-brand-500" : "bg-neutral-400")} />
            <div className="min-w-0 flex-1 p-4">
                <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-primary">{invite.email}</p>
                    <span
                        className={cx(
                            "shrink-0 rounded-lg px-2 py-1 text-xs font-semibold",
                            joined ? "bg-brand-800 text-brand-500" : `${PENDING.badgeBg} ${PENDING.badgeFg}`,
                        )}
                    >
                        {joined ? "Joined" : "Pending"}
                    </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-secondary">
                    {[origin, joined ? `joined ${when(invite.accepted_at)}` : `sent ${when(invite.sent_at)}`]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                {joined && invite.accepted_name && invite.accepted_name !== invite.inviter_name && (
                    <p className="mt-0.5 truncate text-xs text-tertiary">as {invite.accepted_name}</p>
                )}
            </div>
        </button>
    );
}
