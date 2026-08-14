import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download01, Share06, XClose } from "@untitledui/icons";
import { isIos } from "@/utils/is-ios";

/**
 * Manual "Add to Home Screen" steps.
 *
 * Rendered through a PORTAL to document.body. The feed wraps its content in
 * PullToRefresh, which sets `transform: translateY(...)` — and a transformed
 * ancestor becomes the containing block for `position: fixed` descendants, even
 * at translateY(0). Inside it, `fixed inset-0` sized itself to the whole feed
 * rather than the viewport, so the guide opened somewhere below the fold and
 * the screen looked blank until you scrolled.
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
                  Tap <span className="font-semibold text-primary">•••</span> in Safari's toolbar, then
                  <Share06 className="mx-1 inline size-4 align-text-bottom text-brand-500" aria-hidden="true" />
                  <span className="font-semibold text-primary">Share</span>. On older versions the Share icon is in the
                  toolbar itself.
              </>,
              <>
                  Scroll down the share sheet and tap{" "}
                  <span className="font-semibold text-primary">Add to Home Screen</span>.
              </>,
              <>
                  Tap <span className="font-semibold text-primary">Add</span> — CourtPlay lands on your home screen.
              </>,
          ]
        : [
              <>Open your browser menu.</>,
              <>Choose "Install app" or "Add to Home screen."</>,
              <>Confirm to add CourtPlay to your device.</>,
          ];

    return createPortal(
        <div
            // Same dim and blur as the bottom sheets, so an overlay over the feed
            // looks the same wherever it comes from.
            className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Install CourtPlay"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
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
        </div>,
        document.body,
    );
}
