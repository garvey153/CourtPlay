import { motion } from "motion/react";
import { BANDS, STEP1, type Band } from "@/lib/tutorial-intro";
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
            className="pointer-events-none absolute inset-x-0 w-full max-w-none"
            style={{ transform: `translateY(-${(band.srcTop / STEP1.srcHeight) * 100}%)` }}
        />
    );
}

/**
 * The card stack, the one element the welcome screen and slide 1 have in common.
 *
 * Carries a layoutId so Motion measures it in both places and tweens between
 * them: the welcome screen positions it by the design's proportions, the
 * carousel positions it inside the slide's image box, and neither has to know
 * the other's geometry. `layout="position"` and not the default — the window is
 * the same size in both, and letting Motion animate size instead would scale
 * the screenshot inside it for the length of the tween.
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
            layout="position"
            className={cx("overflow-hidden", className)}
            style={style}
        >
            <BandImage band={BANDS.cards} alt={alt} />
        </motion.div>
    );
}
