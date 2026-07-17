import { useEffect, useState } from "react";
import { X } from "@untitledui/icons";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "cs_ios_prompt_dismissed";

function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
    return "standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true;
}

export function IosInstallPrompt() {
    const { user } = useAuth();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!user) return;
        if (isIos() && !isInStandaloneMode() && !localStorage.getItem(STORAGE_KEY)) {
            setVisible(true);
        }
    }, [user]);

    if (!visible) return null;

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, "1");
        setVisible(false);
    };

    const share = async () => {
        // Opens the native share sheet, where "Add to Home Screen" lives.
        try {
            if (navigator.share) {
                await navigator.share({ title: "CourtPlay", url: window.location.origin });
            }
        } catch {
            // User cancelled the share sheet — no-op.
        }
    };

    // Matches the post create/delete confirmation banners. Rendered inside the feed
    // list so it scrolls and pulls with the posts (spacing comes from the feed's gap).
    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <X className="size-4" aria-hidden="true" />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">Add CourtPlay to your home screen</p>
            <p className="mt-1 text-sm text-secondary">Tap Share, then "Add to Home Screen" for the best experience.</p>

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
                    onClick={share}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                >
                    Share
                </button>
            </div>
        </div>
    );
}
