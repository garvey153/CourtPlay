import { XClose } from "@untitledui/icons";
import type { GroupSummary } from "@/types/groups";

interface GroupBannerProps {
    group: GroupSummary;
    kind: "added" | "closed";
    onDismiss: () => void;
    /** Opens the group on the profile. */
    onView: () => void;
}

/**
 * Top-of-feed notice that a group you're in changed.
 *
 * Only two kinds, and the omission is deliberate: there is no "you were removed"
 * banner, because a removal leaves no membership row to derive one from. That
 * case is push/email only, and the group vanishing from your profile is the
 * in-app signal. A banner for it would need an events table.
 */
export function GroupBanner({ group, kind, onDismiss, onView }: GroupBannerProps) {
    const added = kind === "added";

    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">
                {added ? "You're in a group" : "A group closed"}
            </p>
            <p className="mt-1 text-sm text-secondary">
                {added
                    ? `You've been added to ${group.name}.`
                    : `${group.name} has been closed. It'll stay on your profile until you remove it.`}
            </p>

            <div className="mt-3 flex items-center gap-3">
                <button
                    type="button"
                    onClick={onDismiss}
                    className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Dismiss
                </button>
                <button
                    type="button"
                    onClick={onView}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                >
                    {added ? "View group" : "Remove it"}
                </button>
            </div>
        </div>
    );
}
