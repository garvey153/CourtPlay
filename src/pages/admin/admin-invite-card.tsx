import { cx } from "@/utils/cx";

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
 */
export function AdminInviteCard({ invite, onOpen }: { invite: AdminInviteRow; onOpen: () => void }) {
    const joined = !!invite.accepted_at;
    const origin =
        invite.source === "backfill"
            ? "Founding member"
            : invite.inviter_name
              ? `Invited by ${invite.inviter_name}`
              : "Seeded by admin";

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
                    {joined ? (
                        <span className="shrink-0 rounded-lg bg-brand-800 px-2 py-1 text-xs font-semibold text-brand-500">
                            Joined
                        </span>
                    ) : null}
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
