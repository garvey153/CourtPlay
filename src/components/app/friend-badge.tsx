import { cx } from "@/utils/cx";

interface FriendBadgeProps {
    /**
     * A `bg-*` utility matching the colour the card's status TEXT uses —
     * `KIND_CONFIG[kind].accent` on a sub card, the accent bar's colour on a
     * regular-play one.
     */
    accent: string;
}

/**
 * "Friend" on a post card, knocked out of the card's own status colour.
 *
 * The badge inverts rather than introducing a colour: its background is
 * whatever the status text is (green while open, neutral once claimed, red when
 * expired) and its text is the card's background. So it always reads as part of
 * that status. The previous fixed blue was a third colour on a card that
 * already had two, and it stayed blue on a claimed post that had gone grey.
 */
export function FriendBadge({ accent }: FriendBadgeProps) {
    return (
        <span
            className={cx(
                "inline-flex h-4 shrink-0 items-center rounded px-1.5 text-xs font-semibold",
                // The card body's background, so the label reads as a cut-out.
                // No `text-*` token maps to a bg token, hence the variable.
                "text-[var(--color-bg-secondary)]",
                accent,
            )}
        >
            Friend
        </span>
    );
}
