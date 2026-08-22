import { motion } from "motion/react";
import { PRIMARY_CTA } from "@/components/base/buttons/cta";
import {
    BANDS,
    INTRO_TIMING,
    WELCOME_EDGE,
    WELCOME_GAP,
    WELCOME_SKIP_BASELINE_DROP,
    bandAspect,
} from "@/lib/tutorial-intro";
import { CardsBand } from "./tutorial-bands";

/**
 * The screen between finishing onboarding and the tutorial (Figma 675:4527).
 *
 * The posts above the copy are the same ones tutorial step 1 opens on, because
 * they ARE step 1 — the middle band of its screenshot. Showing the tutorial's
 * own image is what lets the two screens agree forever, and it is what the
 * transition then slides into place.
 *
 * IT IS THREE LAYERS, NOT ONE, and that is the transition's doing rather than
 * the layout's. The posts have to slide away to the carousel WHILE this copy is
 * still on screen, so the card stack cannot be a sibling of the copy inside one
 * opaque panel — it leaves (the carousel's band takes over its shared layoutId)
 * and the ground and copy stay behind for another beat:
 *
 *   ground  the green fill, under the carousel, fades out last
 *   band    the card stack, only until the carousel takes it over
 *   copy    the headline and buttons, over the carousel, fades out first
 *
 * Both layers run the same column so the two halves line up: 90px of head room,
 * the card window taking whatever is left, a 10px gap, then the copy. The copy
 * layer keeps an invisible spacer where the window would be.
 */
export function TutorialWelcome({
    onTakeTour,
    onSkip,
    /** False once the stack has left for the carousel. */
    showBand = true,
    /** False once the copy should fade out — the second beat. */
    showCopy = true,
    /** False once the green ground should fade to the tutorial's black. */
    showGround = true,
}: {
    onTakeTour: () => void;
    onSkip: () => void;
    showBand?: boolean;
    showCopy?: boolean;
    showGround?: boolean;
}) {
    const fadeOut = { duration: INTRO_TIMING.fade / 1000, ease: "linear" as const };
    const reveal = { duration: INTRO_TIMING.reveal / 1000, ease: "linear" as const };

    // One column, shared by the ground layer and the copy layer. Both must give
    // the card window the same height, so the copy layer keeps an invisible
    // spacer where the window is and carries its bottom padding on the panel.
    // No horizontal padding here: the two layers pad differently. The band layer
    // insets its window; the copy layer's ground has to reach the screen edges,
    // so it pads inside itself. Putting px-9 here and px-0 on the copy layer
    // does NOT work — same property, and which wins is stylesheet order, not
    // class order, so the copy came out double-inset with the ground short of
    // the edges.
    const column = "pointer-events-none fixed inset-0 z-0 flex flex-col";
    const bottomPad = WELCOME_EDGE - WELCOME_SKIP_BASELINE_DROP;
    const columnStyle = { paddingTop: WELCOME_EDGE, gap: WELCOME_GAP };

    return (
        <>
            <motion.div
                className="fixed inset-0 z-0 bg-[#08180e]"
                animate={{ opacity: showGround ? 1 : 0 }}
                transition={showGround ? { duration: 0 } : reveal}
            />

            {showBand && (
                <div
                    className={`${column} items-center px-9`}
                    style={{ ...columnStyle, paddingBottom: bottomPad }}
                    aria-hidden={!showCopy}
                >
                    <div className="relative w-full max-w-[330px] flex-1 overflow-hidden">
                        <CardsBand
                            className="absolute inset-x-0 top-0"
                            style={{ aspectRatio: bandAspect(BANDS.cards) }}
                            alt="Three open spots in the CourtPlay feed."
                        />
                    </div>
                    {/* Mirrors the copy layer's height so the window ends where
                        the copy begins, without either layer measuring the other. */}
                    <Copy hidden onTakeTour={onTakeTour} onSkip={onSkip} />
                </div>
            )}

            <motion.div
                className={`${column} z-20`}
                style={columnStyle}
                animate={{ opacity: showCopy ? 1 : 0 }}
                transition={fadeOut}
            >
                <div className="flex-1" />
                {/* The copy stands on its own ground, full bleed. Without it the
                    posts slide BETWEEN the green fill and the copy — the fill is
                    below the carousel, the copy above it — and the headline ends
                    up printed straight over the cards mid-slide. */}
                <div className="relative bg-[#08180e] px-9" style={{ paddingBottom: bottomPad }}>
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-full h-12 bg-gradient-to-b from-transparent to-[#08180e]"
                    />
                    <div className="mx-auto w-full max-w-[330px]">
                        <Copy onTakeTour={onTakeTour} onSkip={onSkip} interactive={showCopy} />
                    </div>
                </div>
            </motion.div>
        </>
    );
}

/**
 * The copy block. Rendered twice — once for real, once invisibly in the band
 * layer purely to reserve the same height, so the card window stops in the same
 * place in both. Cheaper and steadier than measuring one layer from the other.
 */
function Copy({
    onTakeTour,
    onSkip,
    hidden = false,
    interactive = false,
}: {
    onTakeTour: () => void;
    onSkip: () => void;
    hidden?: boolean;
    interactive?: boolean;
}) {
    return (
        <div
            className={`flex w-full max-w-[330px] shrink-0 flex-col gap-3 ${hidden ? "invisible" : ""} ${
                interactive ? "pointer-events-auto" : ""
            }`}
            aria-hidden={hidden}
        >
            <h1 className="text-display-md font-semibold tracking-[-0.72px] text-primary">
                Nice work.
                <br />
                Hello, CourtPlay.
            </h1>

            <p className="text-sm text-secondary">
                CourtPlay fills the gaps in your games. Post when you&apos;re short a player, claim when you want to
                play. No group chat archaeology required.
            </p>
            <p className="text-sm text-secondary">Take 30 seconds and we&apos;ll show you how it works.</p>

            {/* 23px above the button, on top of the 12px column gap. */}
            <div className="flex flex-col gap-4 pt-[23px]">
                <button type="button" onClick={onTakeTour} className={`${PRIMARY_CTA} w-full`} tabIndex={hidden ? -1 : undefined}>
                    Take the tour
                </button>
                <button
                    type="button"
                    onClick={onSkip}
                    tabIndex={hidden ? -1 : undefined}
                    className="w-full text-center text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Skip for now
                </button>
            </div>
        </div>
    );
}
