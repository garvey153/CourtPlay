import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ChevronDown, DotsHorizontal, PlusSquare, Share02, XClose } from "@untitledui/icons";
import type { FC, SVGProps } from "react";
import { PRIMARY_MD_FULL as PRIMARY_BTN } from "@/components/base/buttons/button-styles";
import { isIos } from "@/utils/is-ios";

/**
 * Manual "Add to Home Screen" steps, as a bottom sheet (Figma 659:2070).
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

    // Each step is the icon you are looking for plus where it is. Showing the
    // actual glyph beats naming it: on iOS every one of these is an unlabelled
    // icon in Safari's chrome.
    const steps: Array<{ icon: FC<SVGProps<SVGSVGElement>>; text: string }> = ios
        ? [
              { icon: DotsHorizontal, text: "Tap this icon in Safari's toolbar. It's located at the bottom-right of the screen." },
              { icon: Share02, text: "Tap Share at the top of the menu. On older versions the Share icon is in the toolbar itself." },
              { icon: ChevronDown, text: "Tap View More to show more actions. It's located at the bottom-right of the screen." },
              { icon: PlusSquare, text: "Tap Add to Home Screen and CourtPlay will land on your home screen." },
          ]
        : [
              { icon: DotsHorizontal, text: "Open your browser's menu." },
              { icon: PlusSquare, text: "Choose Install app, or Add to Home screen." },
              { icon: ChevronDown, text: "Confirm, and CourtPlay lands on your device." },
          ];

    return createPortal(
        <div
            // Same dim and blur as the app's other bottom sheets, so an overlay
            // over the feed looks the same wherever it comes from.
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Install CourtPlay"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                // pb: the design's 32px, plus the home-indicator inset. A `fixed`
                // sheet sits outside the layout that would otherwise apply it.
                className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-secondary pt-[18px] pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-lg p-2 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
                </button>

                <div className="flex flex-col gap-4 px-5">
                    <div className="flex flex-col gap-0.5 pr-10">
                        <h2 className="text-md font-semibold text-primary">Install CourtPlay</h2>
                        <p className="text-xs text-secondary">
                            Add CourtPlay to your home screen for a full-screen, app-like experience.
                        </p>
                    </div>

                    <ol className="flex flex-col gap-4">
                        {steps.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex gap-3">
                                {/* self-stretch + items-center: the design centres the
                                    28px disc against the full height of the row, not
                                    against the first line (Figma puts it at y=6 in a
                                    40px row). */}
                                <span className="flex shrink-0 items-center self-stretch" aria-hidden="true">
                                    <span className="flex size-7 items-center justify-center rounded-full bg-white">
                                        {/* A white disc with the glyph knocked out in
                                            bg/secondary — the sheet's own background,
                                            which is why this references a background
                                            token rather than a foreground one.
                                            strokeWidth 1 on every icon: the Untitled UI
                                            defaults differ per glyph, which is what made
                                            some look heavier than others. */}
                                        <Icon
                                            className="size-[18.67px] text-[var(--color-bg-secondary)]"
                                            strokeWidth={1}
                                        />
                                    </span>
                                </span>
                                <span className="pt-1 text-xs text-secondary">{text}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* 40px from the last line's baseline to the top of the button.
                    A CSS gap starts from the text BOX, so this is 40 minus the
                    baseline-to-box-bottom distance, measured in the browser rather
                    than derived from font metrics. */}
                <div className="mt-[37px] px-5">
                    <button type="button" onClick={onClose} className={PRIMARY_BTN}>
                        Done
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
