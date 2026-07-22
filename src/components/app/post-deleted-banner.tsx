import { XClose } from "@untitledui/icons";

interface PostDeletedBannerProps {
    onDismiss: () => void;
    /** Restore the just-deleted post. */
    onUndo: () => void;
    /** Whether the undo is in flight. */
    undoing?: boolean;
}

/** Confirmation banner shown at the top of the Created tab after a post is deleted. */
export function PostDeletedBanner({ onDismiss, onUndo, undoing }: PostDeletedBannerProps) {
    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <XClose className="size-5" strokeWidth={1} />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">Post deleted</p>
            <p className="mt-1 text-sm text-secondary">Your post has been removed.</p>

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
                    onClick={onUndo}
                    disabled={undoing}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600 disabled:opacity-50"
                >
                    Undo
                </button>
            </div>
        </div>
    );
}
