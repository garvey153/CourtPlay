import { useEffect, useState } from "react";
import { Share07, X } from "@untitledui/icons";
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

    return (
        <div className="mx-4 mt-3 flex items-start gap-3 rounded-lg border border-secondary bg-primary p-3 shadow-sm">
            <Share07 className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden="true" />
            <p className="flex-1 text-sm text-secondary">
                <span className="font-semibold text-primary">Add CourtPlay to your home screen</span>
                <br />
                Tap <Share07 className="inline size-3.5 text-secondary" aria-hidden="true" /> then "Add to Home Screen" for the best experience.
            </p>
            <button onClick={dismiss} className="mt-0.5 shrink-0 rounded p-0.5 text-quaternary hover:text-secondary">
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Dismiss</span>
            </button>
        </div>
    );
}
