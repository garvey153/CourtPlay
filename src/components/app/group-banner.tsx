import { XClose } from "@untitledui/icons";
import type { GroupSummary } from "@/types/groups";

interface GroupBannerProps {
    group: GroupSummary;
    kind: "added" | "closed" | "removed";
    onDismiss: () => void;
    /** Opens the group on the profile. */
    onView: () => void;
}

/**
 * Top-of-feed notice that a group you're in changed.
 *
 * Removal is derivable because the membership row is kept and stamped rather
 * than deleted (20260804000004) — the row is the event record, so no separate
 * events table was needed.
 */
export function GroupBanner({ group, kind, onDismiss, onView }: GroupBannerProps) {
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
                {kind === "added" ? "You're in a group" : kind === "removed" ? "Group update" : "A group closed"}
            </p>
            <p className="mt-1 text-sm text-secondary">
                {kind === "added"
                    ? `You've been added to ${group.name}.`
                    : kind === "removed"
                      ? `You're no longer in ${group.name}.`
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
                {/* A removed player has nothing left to open, so the notice is
                    informational and carries no action beyond dismissing it. */}
                {kind !== "removed" && (
                    <button
                        type="button"
                        onClick={onView}
                        className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                    >
                        {kind === "added" ? "View group" : "Remove it"}
                    </button>
                )}
            </div>
        </div>
    );
}
