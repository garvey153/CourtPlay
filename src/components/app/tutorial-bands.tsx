import { motion } from "motion/react";
import { BANDS, INTRO_TIMING, STEP1, type Band } from "@/lib/tutorial-intro";
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
}: {
    className?: string;
    style?: React.CSSProperties;
    alt?: string;
}) {
    return (
        <motion.div
            layoutId="tutorial-feed-cards"
            // Full layout, not "position". The welcome screen sizes the stack to
            // fit all three posts in the room it has; the carousel shows it at
            // the screenshot's own width, so the size genuinely changes. The
            // usual objection — Motion tweens size as a transform and distorts
            // the content — does not apply here: both ends carry the same aspect
            // ratio, so the tween is a uniform scale.
            layout
            // Spelled out rather than left to Motion's default spring: this is
            // the first beat of a timed sequence, and the beats after it are
            // scheduled off INTRO_TIMING.
            transition={{ duration: INTRO_TIMING.slide / 1000, ease: "easeInOut" }}
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
        </motion.div>
    );
}
