import { motion } from "motion/react";
import { PRIMARY_CTA } from "@/components/base/buttons/cta";
import { BANDS, INTRO_TIMING, WELCOME_CARDS_WINDOW, bandAspect } from "@/lib/tutorial-intro";
import { CardsBand } from "./tutorial-bands";

/**
 * The screen between finishing onboarding and the tutorial (Figma 675:4527).
 *
 * The posts above the copy are the same ones tutorial step 1 opens on, because
 * they ARE step 1 — the middle band of its screenshot. Showing the tutorial's
 * own image is what lets the two screens agree forever, and it is what the
 * transition then slides into place.
 *
 * LAYOUT IS THE DESIGN'S AUTO-LAYOUT, not offsets copied off it. The frame is a
 * centred column: a 374px window of posts, a 10px gap, then the copy. The 54.5px
 * above the posts and below Skip for now are what centring leaves over in an
 * 812-tall frame — a consequence, not a measurement, which is why placing them
 * by ratio (the first attempt) came out wrong on a phone that is not 812 tall.
 *
 * The window shrinks on a short screen rather than pushing the buttons off the
 * bottom; the posts are the part that can afford to lose a few pixels.
 */
/**
 * A floor under the centring, not a substitute for it.
 *
 * On the frame the design was drawn at this changes nothing — centring still
 * leaves 54.5px above the posts and below Skip for now, because the padding
 * comes out of the same slack. On a short phone, where there is no slack left,
 * it is what keeps Skip for now off the home indicator rather than hard against
 * the bottom edge.
 */
const FLOOR = {
    paddingTop: "calc(2.25rem + env(safe-area-inset-top))",
    paddingBottom: "calc(2.25rem + env(safe-area-inset-bottom))",
};

export function TutorialWelcome({
    onTakeTour,
    onSkip,
    /** True once Take the tour is tapped: the copy leaves and the ground turns black. */
    leaving = false,
}: {
    onTakeTour: () => void;
    onSkip: () => void;
    leaving?: boolean;
}) {
    const fade = { duration: INTRO_TIMING.fade / 1000, ease: "linear" as const };

    return (
        <motion.div
            className="fixed inset-0 flex flex-col items-center justify-center gap-[10px] overflow-hidden px-9"
            style={FLOOR}
            initial={{ backgroundColor: "#08180e" }}
            animate={{ backgroundColor: leaving ? "#000000" : "#08180e" }}
            transition={fade}
        >
            {/* The window on to the card stack. A hard 374px, as the design draws
                it — the fade only softens where it cuts, since our posts are the
                real ones and taller than the mockup's placeholders. */}
            <div
                className="relative w-full max-w-[330px] shrink overflow-hidden"
                style={{ height: WELCOME_CARDS_WINDOW, minHeight: 0 }}
            >
                <CardsBand
                    className="absolute inset-x-0 top-0"
                    style={{ aspectRatio: bandAspect(BANDS.cards) }}
                    alt="Three open spots in the CourtPlay feed."
                />
                {/* Inside the window, so the posts have ended by its bottom edge
                    and the 10px gap below reads as the design's gap rather than
                    as cards running under the headline. */}
                <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[#08180e]"
                    animate={{ opacity: leaving ? 0 : 1 }}
                    transition={fade}
                />
            </div>

            <motion.div
                className="flex w-full max-w-[330px] shrink-0 flex-col gap-3"
                animate={{ opacity: leaving ? 0 : 1 }}
                transition={fade}
            >
                <h1 className="text-display-md font-semibold tracking-[-0.72px] text-primary">
                    Nice work.
                    <br />
                    Hello, CourtPlay.
                </h1>

                <p className="text-sm text-secondary">
                    CourtPlay fills the gaps in your games. Post when you&apos;re short a player, claim when you want
                    to play. No group chat archaeology required.
                </p>
                <p className="text-sm text-secondary">Take 30 seconds and we&apos;ll show you how it works.</p>

                {/* 23px above the button, on top of the 12px column gap. */}
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
            </motion.div>
        </motion.div>
    );
}
