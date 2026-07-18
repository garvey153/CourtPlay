import { XClose } from "@untitledui/icons";

interface PostSuccessBannerProps {
    /** Which kind of post was just created — drives the confirmation copy. */
    postType: "sub_need" | "regular_game";
    onDismiss: () => void;
    /** Opens the just-created post in the edit form. */
    onEdit: () => void;
}

/** Confirmation banner shown at the top of the feed after a post is created. */
export function PostSuccessBanner({ postType, onDismiss, onEdit }: PostSuccessBannerProps) {
    const body =
        postType === "regular_game"
            ? "Your availability and preferences can now be found by other players."
            : "Your open spot is now visible to players looking for a game.";

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

            <p className="pr-6 text-sm font-semibold text-primary">Post successful!</p>
            <p className="mt-1 text-sm text-secondary">{body}</p>

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
                    onClick={onEdit}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                >
                    Edit post
                </button>
            </div>
        </div>
    );
}
