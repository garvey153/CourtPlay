import { motion } from "motion/react";
import { PRIMARY_CTA } from "@/components/base/buttons/cta";
import { BANDS, INTRO_TIMING, WELCOME_CARDS_TOP_RATIO, bandAspect } from "@/lib/tutorial-intro";
import { CardsBand } from "./tutorial-bands";

/**
 * The screen between finishing onboarding and the tutorial (Figma 675:4527).
 *
 * The posts above the copy are the same ones tutorial step 1 opens on, because
 * they ARE step 1 — the middle band of its screenshot, positioned by the
 * design's proportions. Showing the tutorial's own image is what lets the two
 * screens agree forever, and it is what the transition then slides into place.
 *
 * Positions are ratios of the frame the design was drawn at (402x812) rather
 * than fixed offsets: the stack hangs from the top, the copy sits on the bottom,
 * and a short phone eats into the gap between them instead of pushing the
 * buttons off the screen. The fade over the stack's lower half is doing real
 * work there — it is what lets the cards run under the copy without colliding.
 */
export function TutorialWelcome({
    firstName,
    onTakeTour,
    onSkip,
    /** True once Take the tour is tapped: the copy leaves and the ground turns black. */
    leaving = false,
}: {
    firstName?: string | null;
    onTakeTour: () => void;
    onSkip: () => void;
    leaving?: boolean;
}) {
    return (
        <motion.div
            className="fixed inset-0 overflow-hidden"
            initial={{ backgroundColor: "#08180e" }}
            animate={{ backgroundColor: leaving ? "#000000" : "#08180e" }}
            transition={{ duration: INTRO_TIMING.fade / 1000, ease: "linear" }}
        >
            {/* The card stack. Full band height always — the fade below, not a
                shorter window, is what keeps it clear of the copy. Sizing it the
                same here and in the carousel is what lets the shared-element
                transition animate position alone. */}
            <div className="absolute left-9 w-[330px] max-w-[calc(100%_-_4.5rem)]" style={{ top: `${WELCOME_CARDS_TOP_RATIO * 100}dvh` }}>
                <CardsBand className="relative w-full" style={{ aspectRatio: bandAspect(BANDS.cards) }} alt="Three open spots in the CourtPlay feed." />
            </div>

            {/* The copy and the ground it stands on, as one bottom-anchored
                block. The gradient rides directly above the text rather than at
                a fixed height, which is what actually guarantees the stack has
                faded out by the time it reaches a word — the first attempt put
                the fade at a ratio of the viewport and the third card read
                straight through the headline. */}
            <motion.div
                className="absolute inset-x-0 bottom-0"
                animate={{ opacity: leaving ? 0 : 1 }}
                transition={{ duration: INTRO_TIMING.fade / 1000, ease: "linear" }}
            >
                <div aria-hidden="true" className="h-24 bg-gradient-to-b from-transparent to-[#08180e]" />

                <div className="flex flex-col gap-3 bg-[#08180e] px-9" style={{ paddingBottom: `${WELCOME_CARDS_TOP_RATIO * 100}dvh` }}>
                    <h1 className="text-display-md font-semibold tracking-[-0.72px] text-primary">
                        {firstName ? `Nice work, ${firstName}.` : "Nice work."}
                        <br />
                        Setup done.
                    </h1>

                    <p className="text-sm text-secondary">
                        CourtPlay fills the gaps in your games. Post when you&apos;re short a player, claim when you want to play. No group chat archaeology
                        required.
                    </p>
                    <p className="text-sm text-secondary">Take 30 seconds and we&apos;ll show you how it works.</p>

                    {/* 23px above the button in the design, on top of the 12px column gap. */}
                    <div className="flex flex-col gap-4 pt-[23px]">
                        <button type="button" onClick={onTakeTour} className={`${PRIMARY_CTA} w-full`}>
                            Take the tour
                        </button>
                        <button
                            type="button"
                            onClick={onSkip}
                            className="w-full text-center text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
