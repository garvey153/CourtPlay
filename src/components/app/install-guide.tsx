import { useEffect } from "react";
import { Download01, Share06, XClose } from "@untitledui/icons";
import { isIos } from "@/utils/is-ios";

/**
 * Manual "Add to Home Screen" steps.
 *
 * iOS has no programmatic install API, and `navigator.share()` does NOT help:
 * it opens the content share sheet (send this URL to another app), which has no
 * "Add to Home Screen" entry. That action lives only in Safari's own toolbar
 * Share sheet, which a page cannot open. So the only honest option is to tell
 * the user where to find it.
 */
export function InstallGuide({ onClose }: { onClose: () => void }) {
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
