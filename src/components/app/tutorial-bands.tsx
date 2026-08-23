import { motion } from "motion/react";
import {
    BANDS,
    CAROUSEL_INTRO_TOTAL,
    INTRO_EASE,
    INTRO_TIMING,
    STEP1,
    TAIL_FADE,
    THIRD_POST_TOP,
    type Band,
} from "@/lib/tutorial-intro";
import { cx } from "@/utils/cx";

/** The step-1 screenshot, named once — the welcome screen and slide 1 share it. */
export const STEP1_IMAGE = "/tutorial/01-feed.jpg";

/**
 * One horizontal slice of the step-1 screenshot.
 *
 * The window is sized by its parent; the image inside is full width and shifted
 * up by its own height, so the slice shows through. A percentage of the IMAGE's
 * height rather than the window's is what makes this hold when the welcome
 * screen and the tutorial give the window different heights — and it is why the
 * three bands still meet exactly when they come back together.
 */
export function BandImage({ band, alt }: { band: Band; alt?: string }) {
    return (
        <img
            src={STEP1_IMAGE}
            alt={alt ?? ""}
            aria-hidden={alt ? undefined : "true"}
            width={STEP1.srcWidth}
            height={STEP1.srcHeight}
            className="pointer-events-none absolute inset-x-0"
            // Width and height inline rather than as classes. The width/height
            // ATTRIBUTES above are there to reserve the aspect ratio before the
            // image loads, and they were beating `w-full`: the image kept its
            // intrinsic 390x844 while the band around it was narrower, so the
            // slice came out at the wrong scale and showed the wrong rows.
            //
            // The translate is a percentage of the image's OWN height, which is
            // what keeps the slice correct at any width the band happens to be.
            style={{
                width: "100%",
                height: "auto",
                maxWidth: "none",
                transform: `translateY(-${(band.srcTop / STEP1.srcHeight) * 100}%)`,
            }}
        />
    );
}

/**
 * The card stack, the one element the welcome screen and slide 1 have in common.
 *
 * Carries a layoutId so Motion measures it in both places and tweens between
 * them: the welcome screen positions it by the design's proportions, the
 * carousel positions it inside the slide's image box, and neither has to know
 * the other's geometry — including the size, which differs between them.
 */
export function CardsBand({
    className,
    style,
    alt,
    fadeTail = false,
}: {
    className?: string;
    style?: React.CSSProperties;
    alt?: string;
    /** Take the third post out over the slide, and bring it back with step 1. */
    fadeTail?: boolean;
}) {
    return (
        <motion.div
            layoutId="tutorial-feed-cards"
            // Position only. The stack is 330px wide in both places and must
            // never resize — it slides, and that is all. Letting Motion animate
            // size was tried and is wrong twice over: it scales the screenshot
            // for the length of the tween, and it only arose from sizing the
            // welcome stack to fit, which is not how the welcome screen shows
            // three posts. The copy covers them; moving it uncovers them.
            layout="position"
            // Spelled out rather than left to Motion's default spring: this is
            // the first beat of a timed sequence, and the beats after it are
            // scheduled off INTRO_TIMING.
            transition={{ duration: INTRO_TIMING.slide / 1000, ease: INTRO_EASE.slide }}
            // `relative` is load-bearing: the image inside is absolutely
            // positioned, so this has to be its containing block. Without it the
            // image sized itself against whatever ancestor happened to be
            // positioned — 390px of screen — and the slice came out at the wrong
            // scale showing the wrong rows. It only ever worked because both
            // callers happened to pass `absolute`.
            className={cx("relative overflow-hidden", className)}
            style={style}
        >
            <BandImage band={BANDS.cards} alt={alt} />
            {fadeTail && <TailFade />}
        </motion.div>
    );
}

/**
 * The third post dissolving into the ground as the stack slides, and coming
 * back as part of step 1.
 *
 * A cover in the ground's own colour rather than anything applied to the post
 * itself — the posts are one photograph, so there is no third post to give an
 * opacity to. Its top edge sits in the gap above the card, so nothing of the
 * card survives underneath it.
 *
 * One element, three beats, as keyframes: straight out over the first half of
 * the slide, held while the stack settles, then back on the reveal's curve —
 * step 1 does show this post, and leaving the cover up would put a hole in the
 * screenshot.
 */
function TailFade() {
    return (
        <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#08180e]"
            style={{ top: `${THIRD_POST_TOP * 100}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
                duration: CAROUSEL_INTRO_TOTAL / 1000,
                times: [0, TAIL_FADE / CAROUSEL_INTRO_TOTAL, INTRO_TIMING.slide / CAROUSEL_INTRO_TOTAL, 1],
                ease: [INTRO_EASE.tail, INTRO_EASE.tail, INTRO_EASE.in],
            }}
        />
    );
}
