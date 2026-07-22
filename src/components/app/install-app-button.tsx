import { useEffect, useState } from "react";
import { Download01, Share06, XClose } from "@untitledui/icons";
import { isStandalone } from "@/utils/is-standalone";
import { cx } from "@/utils/cx";

// CourtPlay design-system Secondary button (Figma node 32:104, size M): a filled
// bg-tertiary surface with secondary text — matches the app's existing SECONDARY_BTN.
const SECONDARY_BTN =
    "inline-flex items-center justify-center gap-1 rounded-lg bg-tertiary px-5 py-3 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

// Chrome / Edge / Android fire `beforeinstallprompt` before offering to install;
// capturing it lets our own button trigger the native install prompt on tap.
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
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

function InstallGuide({ onClose }: { onClose: () => void }) {
    const ios = isIos();

    // Dismiss on Escape and lock body scroll while the guide is open.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const steps = ios
        ? [
              <>
                  Tap the <Share06 className="mx-0.5 inline size-4 align-text-bottom text-brand-500" aria-hidden="true" /> Share
                  icon in Safari's toolbar.
              </>,
              <>Scroll down and tap "Add to Home Screen."</>,
              <>Tap "Add" — CourtPlay lands on your home screen.</>,
          ]
        : [
              <>Open your browser menu.</>,
              <>Choose "Install app" or "Add to Home screen."</>,
              <>Confirm to add CourtPlay to your device.</>,
          ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Install CourtPlay"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-sm rounded-2xl bg-secondary p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
                </button>

                <div className="flex flex-col items-center gap-1 text-center">
                    <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-brand-secondary">
                        <Download01 className="size-6 text-brand-500" strokeWidth={1} aria-hidden="true" />
                    </div>
                    <h2 className="text-lg font-semibold text-primary">Install CourtPlay</h2>
                    <p className="text-sm text-secondary">
                        Add CourtPlay to your home screen for a full-screen, app-like experience.
                    </p>
                </div>

                <ol className="mt-5 flex flex-col gap-3">
                    {steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-secondary">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-brand-500">
                                {i + 1}
                            </span>
                            <span>{step}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}
