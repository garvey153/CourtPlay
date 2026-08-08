import { cx } from "@/utils/cx";

/** A group as listed by admin_get_groups(). */
export interface AdminGroupRow {
    id: string;
    name: string;
    details: string | null;
    created_at: string;
    closed_at: string | null;
    creator_id: string;
    creator_name: string;
    member_count: number;
}

interface AdminGroupCardProps {
    group: AdminGroupRow;
    onOpen: () => void;
}

/**
 * Feed-style group card for the admin Groups tab, following AdminCourtCard.
 *
 * A closed group keeps its place in the list rather than being filtered out —
 * it is a tombstone the creator can still act on, and an admin looking into a
 * report needs to see it. The neutral bar is what says so.
 */
export function AdminGroupCard({ group, onOpen }: AdminGroupCardProps) {
    const closed = group.closed_at != null;
    const players = `${group.member_count} ${group.member_count === 1 ? "player" : "players"}`;
    const subtitle = [group.creator_name || "Unknown", players, group.details].filter(Boolean).join(" · ");

    return (
        <button type="button" onClick={onOpen} className="flex w-full overflow-hidden rounded text-left">
            <span className={cx("w-1 shrink-0 self-stretch", closed ? "bg-neutral-400" : "bg-brand-500")} aria-hidden="true" />

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                <div className="flex items-center gap-2">
                    <p className={cx("truncate text-md font-semibold", closed ? "text-tertiary" : "text-primary")}>
                        {group.name}
                    </p>
                    {closed && (
                        <span className="shrink-0 rounded-lg bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-neutral-400">
                            Closed
                        </span>
                    )}
                </div>
                <p className="truncate text-xs text-tertiary">{subtitle}</p>
            </div>
        </button>
    );
}
