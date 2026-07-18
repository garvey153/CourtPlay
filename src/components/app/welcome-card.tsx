import { XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

interface WelcomeCardProps {
    onDismiss: () => void;
    onPost: () => void;
}

export function WelcomeCard({ onDismiss, onPost }: WelcomeCardProps) {
    return (
        <div className="relative rounded-xl border border-brand bg-brand-secondary p-4">
            <button
                onClick={onDismiss}
                className="absolute right-3 top-3 rounded p-0.5 text-brand-tertiary hover:text-brand-secondary"
                aria-label="Dismiss"
            >
                <XClose className="size-5" strokeWidth={1} />
            </button>

            <p className="pr-6 text-sm font-semibold text-brand-primary">Welcome to CourtPlay 🎾</p>
            <p className="mt-1.5 text-sm text-brand-secondary">
                This is the Westport tennis sub feed. When you need a sub for your game, post here and
                available players will claim your spot. You can also claim spots others have posted.
            </p>
            <p className="mt-2 text-sm text-brand-secondary">
                Posts sort by soonest game date first — your friends' posts appear at the top of each
                date group.
            </p>

            <Button color="primary" size="sm" className="mt-3" onClick={onPost}>
                Post your first game
            </Button>
        </div>
    );
}
