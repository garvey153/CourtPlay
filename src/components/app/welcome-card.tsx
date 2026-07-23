import { XClose } from "@untitledui/icons";

interface WelcomeCardProps {
    onDismiss: () => void;
    onPost: () => void;
}

/**
 * First-run welcome shown once to new users (until dismissed). Uses the shared
 * confirmation-banner styling (matches PushEnableBanner / PostSuccessBanner).
 */
export function WelcomeCard({ onDismiss, onPost }: WelcomeCardProps) {
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

            <p className="pr-6 text-sm font-semibold text-primary">Welcome to CourtPlay 🎾</p>
            <p className="mt-1 text-sm text-secondary">
                This is the Westport tennis sub feed. When you need a sub for your game, post here and
                available players will claim your spot. You can also claim spots others have posted.
            </p>
            <p className="mt-2 text-sm text-secondary">
                Posts sort by soonest game date first — your friends' posts appear at the top of each
                date group.
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
                    onClick={onPost}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                >
                    Post your first game
                </button>
            </div>
        </div>
    );
}
