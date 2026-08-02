import { useEffect, useState } from "react";
import { Download01 } from "@untitledui/icons";
import { InstallGuide } from "@/components/app/install-guide";
import { isStandalone } from "@/utils/is-standalone";
import { cx } from "@/utils/cx";
import { SECONDARY_LG_GAP1 as SECONDARY_BTN } from "@/components/base/buttons/button-styles";

// CourtPlay design-system Secondary button (Figma node 32:104, size M): a filled
// bg-tertiary surface with secondary text — matches the app's existing SECONDARY_BTN.

// Chrome / Edge / Android fire `beforeinstallprompt` before offering to install;
// capturing it lets our own button trigger the native install prompt on tap.
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallAppButtonProps {
    className?: string;
    label?: string;
}

/**
 * "Download the app" CTA. CourtPlay ships as a PWA (see the product plan — native
 * App Store distribution is V2), so "installing" means adding it to the home screen.
 * On browsers that support it we trigger the native install prompt; on iOS Safari
 * (which has no such API) we show the manual Share → Add to Home Screen steps.
 */
export function InstallAppButton({ className, label = "Download the app" }: InstallAppButtonProps) {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        setInstalled(isStandalone());
        const onPrompt = (e: Event) => {
            // Stop the browser's default mini-infobar so our button owns the flow.
            e.preventDefault();
            setDeferred(e as BeforeInstallPromptEvent);
        };
        const onInstalled = () => setInstalled(true);
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    // Already running as an installed app — nothing to offer.
    if (installed) return null;

    const handleClick = async () => {
        if (deferred) {
            await deferred.prompt();
            const { outcome } = await deferred.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setDeferred(null);
            return;
        }
        // iOS Safari (and any browser without the install API): show manual steps.
        setShowGuide(true);
    };

    return (
        <>
            <button type="button" onClick={handleClick} className={cx(SECONDARY_BTN, className)}>
                <Download01 className="size-5" strokeWidth={1} aria-hidden="true" />
                {label}
            </button>
            {showGuide && <InstallGuide onClose={() => setShowGuide(false)} />}
        </>
    );
}
