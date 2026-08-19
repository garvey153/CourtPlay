/**
 * "Closed" status badge for a group, from design-system 95:212.
 *
 * The design's tokens land exactly on this theme's: `status/error-bg` #7a271a is
 * red-900, `status/error_badge` #f97066 is red-400. So the colours were already
 * right where this badge was hand-rolled, and the vertical padding was half the
 * design's.
 *
 * The design (95:212) also has a leading dot. It is gone: status badges across
 * the app dropped theirs, since the badge's own background and text colour
 * already carry the state. This one was missed at the time because its dot
 * carries an extra class the sweep did not match on.
 *
 * Shared because it appears in two places (Profile's group list and the group
 * detail sheet) that had drifted from the design in the same way, and would
 * drift again separately.
 */
export function ClosedBadge({ className }: { className?: string }) {
    return (
        <span
            className={
                "inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-900 px-2 py-1 text-xs font-semibold text-red-400" +
                (className ? ` ${className}` : "")
            }
        >
            Closed
        </span>
    );
}
