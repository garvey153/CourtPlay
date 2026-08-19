import { Avatar } from "@/components/base/avatar/avatar";
import { ClosedBadge } from "@/components/app/closed-badge";
import { cx } from "@/utils/cx";
import { describeMembers, type GroupSummary } from "@/types/groups";

/**
 * One group in the list on your profile.
 *
 * Extracted from profile.tsx so the tutorial can show the real card instead of
 * a copy of its markup — a copy would drift silently, which is precisely what
 * the screenshot fingerprint test cannot catch.
 */
export function GroupCard({ group, onOpen }: { group: GroupSummary; onOpen: () => void }) {
    return (
        <button
            type="button"
            onClick={onOpen}
            // Gaps are set per-pair rather than one uniform gap: the name and its
            // detail line read as a single block, while the face pile needs air
            // to separate from them.
            className="flex w-full flex-col rounded-lg bg-secondary p-4 text-left transition duration-100 ease-linear hover:bg-secondary_hover"
        >
            {/* A closed group is a tombstone until its remaining members clear it,
                so its content is dimmed the way an expired post is. The dimming
                sits on the CONTENT, not the card: opacity composites the whole
                subtree, so dimming the card took the Closed badge with it — and
                the badge is the one thing that should stay legible. */}
            <div className={cx("flex w-full items-start justify-between gap-2", group.is_closed && "[&>p]:opacity-60")}>
                <p className="truncate text-sm font-semibold text-primary">{group.name}</p>
                {group.is_closed && <ClosedBadge />}
            </div>
            <p className={cx("mt-0.5 truncate text-sm text-secondary", group.is_closed && "opacity-60")}>
                {[group.details, `${group.member_count} player${group.member_count === 1 ? "" : "s"}`]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
            <div className={cx("mt-3 flex items-center gap-2", group.is_closed && "opacity-60")}>
                <div className="flex shrink-0 -space-x-2">
                    {group.members.slice(0, 5).map((m) => (
                        <Avatar
                            key={m.id}
                            size="xs"
                            src={m.photo_url ?? undefined}
                            alt={m.first_name}
                            initials={m.first_name.charAt(0).toUpperCase()}
                            className="bg-white p-px shadow-xs ring-2 ring-bg-secondary"
                        />
                    ))}
                </div>
                <span className="min-w-0 truncate text-sm text-secondary">{describeMembers(group.members)}</span>
            </div>
        </button>
    );
}
