import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { skillLabel } from "@/utils/skill-label";

/** Flat shape the admin users tab feeds each card. Derived from the `users` row. */
export interface AdminUserRow {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    skill_level: string | null;
    is_admin: boolean;
    is_suspended: boolean;
    created_at: string;
    photo_url: string | null;
    report_count: number;
}

export function userDisplayName(user: Pick<AdminUserRow, "first_name" | "last_name" | "email">): string {
    return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
}

interface AdminUserCardProps {
    user: AdminUserRow;
    /** Tapping the card opens the admin detail/actions sheet. */
    onOpen: (user: AdminUserRow) => void;
}

/**
 * Feed-style user card for the admin Users tab (design 345:5521). Left accent bar
 * is green for active users, red for suspended ones.
 */
export function AdminUserCard({ user, onOpen }: AdminUserCardProps) {
    const name = userDisplayName(user);
    const subtitle = skillLabel(user.skill_level) ?? user.email;
    const bar = user.is_suspended ? "bg-red-500" : "bg-brand-500";

    return (
        <button
            type="button"
            onClick={() => onOpen(user)}
            className="flex w-full overflow-hidden rounded text-left"
        >
            {/* Left status accent bar */}
            <span className={cx("w-1 shrink-0 self-stretch", bar)} aria-hidden="true" />

            {/* Card body */}
            <div className="flex min-w-0 flex-1 items-center gap-3 bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                <Avatar
                    size="md"
                    src={user.photo_url}
                    alt={name}
                    initials={(user.first_name ?? user.email).charAt(0).toUpperCase()}
                    className="shrink-0 bg-white p-px shadow-xs"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-md font-semibold text-primary">{name}</p>
                    <p className="truncate text-xs text-secondary">{subtitle}</p>
                </div>
                {user.is_admin && (
                    <span className="shrink-0 rounded-lg bg-tertiary px-2 py-1 text-xs font-semibold text-secondary">
                        Admin
                    </span>
                )}
            </div>
        </button>
    );
}
