import { useCallback, useEffect, useState } from "react";
import { XClose } from "@untitledui/icons";
import { InstallGuide } from "@/components/app/install-guide";
import { useAuth } from "@/hooks/use-auth";
import { isIos } from "@/utils/is-ios";

const STORAGE_KEY = "cs_ios_prompt_dismissed";

function isInStandaloneMode() {
    return "standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Whether to offer the install prompt, and how to put it away.
 *
 * Split from the card because the feed stacks its notifications and has to know
 * how many there are before rendering any of them — a component that decides
 * for itself and returns null can't be counted.
 */
export function useInstallPrompt() {
    const { user } = useAuth();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!user) return;
        if (isIos() && !isInStandaloneMode() && !localStorage.getItem(STORAGE_KEY)) {
            setVisible(true);
        }
    }, [user]);

    const dismiss = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, "1");
        setVisible(false);
    }, []);

    return { visible, dismiss };
}

export function IosInstallPrompt({ onDismiss }: { onDismiss: () => void }) {
    const [showGuide, setShowGuide] = useState(false);
    const dismiss = onDismiss;

    // Matches the post create/delete confirmation banners. Rendered inside the feed
    // list so it scrolls and pulls with the posts (spacing comes from the feed's gap).
    return (
        <>
            <div className="relative rounded-lg bg-brand-800 p-4">
                <button
                    onClick={dismiss}
                    aria-label="Dismiss"
                    className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
                </button>

                <p className="pr-6 text-sm font-semibold text-primary">Add CourtPlay to your home screen</p>
                <p className="mt-1 text-sm text-secondary">
                    It takes three taps from Safari's Share menu — here's where to find it.
                </p>

                <div className="mt-3 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={dismiss}
                        className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                    >
                        Dismiss
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGuide(true)}
                        className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                    >
                        Show me how
                    </button>
                </div>
            </div>
            {showGuide && <InstallGuide onClose={() => setShowGuide(false)} />}
        </>
    );
}
