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
    const columnStyle = {
        paddingTop: `calc(${WELCOME_EDGE}px + env(safe-area-inset-top))`,
        gap: WELCOME_GAP,
    };

    return (
        <>
            {/* Goes black with slide 1's copy, once the posts have finished
                moving — not during the slide. The carousel lays a matching green
                fade over its own black one for the duration, so the posts still
                run out into whatever colour the ground currently is. */}
            <motion.div
                className="fixed inset-0 z-0 bg-[#08180e]"
                animate={{ opacity: showGround ? 1 : 0 }}
                transition={showGround ? { duration: 0 } : { duration: INTRO_TIMING.reveal / 1000, ease: "linear" }}
            />

            {showBand && (
                <div className={`${column} items-center px-9`} style={columnStyle} aria-hidden={!showCopy}>
                    {/* Full size, full height, 330px wide exactly as slide 1
                        shows it — so the move into the carousel is a slide and
                        nothing else. It runs on down behind the copy; all three
                        posts are there from the start, and the copy is simply
                        standing on the lower ones. Fading the copy is what
                        reveals them, which is why this is not clipped to fit. */}
                    <CardsBand
                        className="w-full max-w-[330px] shrink-0"
                        style={{ aspectRatio: bandAspect(BANDS.cards) }}
                        alt="Three open spots in the CourtPlay feed."
                    />
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
                    {/* The same fade the tutorial slides use — h-16, transparent
                        into the page — so the posts run out the same way here as
                        they do behind every step. To the green ground rather than
                        to black, because that is the page it lands on. */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-full h-16 bg-gradient-to-b from-transparent to-[#08180e]"
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
