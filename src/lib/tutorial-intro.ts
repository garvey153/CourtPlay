/**
 * The geometry behind the welcome → tutorial transition.
 *
 * The welcome screen shows the same posts as tutorial step 1 by showing the
 * step-1 SCREENSHOT, sliced into three horizontal bands. That is the whole
 * trick: the bands are cut from one image, so when they come to rest against
 * each other they recompose it exactly. No live card has to be positioned to
 * land on a photograph of itself, and "the same posts" cannot drift, because
 * the welcome screen is literally showing the tutorial's own image.
 *
 *   top     header + the "You're in a group" banner   slides down from above
 *   cards   the three feed posts                      on screen from the start
 *   bottom  the tab bar                               slides up from below
 *
 * The offsets are in the captured screenshot's own coordinate space — CSS px at
 * 390x844, which is the viewport scripts/capture-tutorial.mjs shoots at. They
 * were measured off the rendered demo feed rather than guessed off the JPEG:
 *
 *   header  0–68      banner  68–176     card 0  188–380
 *   card 1  392–606   card 2  618–814    tab bar 776–844
 *
 * Note the tab bar overlaps the third card, which is why `cardsBottom` is where
 * the bar starts rather than where the last card ends: the bands are what you
 * SEE stacked, not what the DOM nests.
 *
 * Everything downstream is expressed as a percentage of these, so the bands
 * stay registered at any display width (the carousel caps the image at 330px
 * but narrow phones render it smaller).
 */
export const STEP1 = {
    /** The captured viewport, in CSS px. */
    srcWidth: 390,
    srcHeight: 844,
    /** The first feed card's top edge. Everything above it is header + banner. */
    cardsTop: 188,
    /**
     * The third card's own bottom edge.
     *
     * The app draws its tab bar over that card, from 776 — so this used to stop
     * there and the card came out cropped anywhere the band was shown on its
     * own. The feed screenshot is now captured with the bar hidden (see
     * demo-entry), which costs the tutorial nothing because slide 1 crops well
     * above where the bar would be, and gives the welcome screen a complete
     * third post.
     */
    cardsBottom: 814,
} as const;

export type BandName = "top" | "cards" | "bottom";

export interface Band {
    /** Offset of this band's top edge within the screenshot, in source px. */
    srcTop: number;
    /** The band's height, in source px. */
    srcHeight: number;
}

export const BANDS: Record<BandName, Band> = {
    top: { srcTop: 0, srcHeight: STEP1.cardsTop },
    cards: { srcTop: STEP1.cardsTop, srcHeight: STEP1.cardsBottom - STEP1.cardsTop },
    bottom: { srcTop: STEP1.cardsBottom, srcHeight: STEP1.srcHeight - STEP1.cardsBottom },
};

/**
 * Where a band sits inside a box holding the whole screenshot, as percentages
 * of that box. Percentages rather than pixels so a narrower phone scales all
 * three identically and they still meet.
 */
export const bandWindow = (band: Band) => ({
    top: `${(band.srcTop / STEP1.srcHeight) * 100}%`,
    height: `${(band.srcHeight / STEP1.srcHeight) * 100}%`,
});

/** The whole screenshot's aspect ratio, for a box that holds all three bands. */
export const STEP1_ASPECT = `${STEP1.srcWidth} / ${STEP1.srcHeight}`;

/**
 * One band's aspect ratio, for a window that holds only that band. Width is the
 * full screenshot width because a band is a full-width slice — only the height
 * is the band's own.
 */
export const bandAspect = (band: Band) => `${STEP1.srcWidth} / ${band.srcHeight}`;

/**
 * Welcome screen spacing, in px (Figma 675:4527 plus the follow-up notes).
 *
 * 36 of visible space at each end: above the first card and below the Skip for
 * now baseline. The card window takes everything left over, so a taller phone
 * shows more posts rather than more empty ground.
 *
 * The top is measured from the SAFE AREA and the bottom from the screen edge,
 * which looks inconsistent written down and is what makes the two ends match on
 * a phone. 36 from the top of the screen is 36 underneath the status bar, so the
 * card arrived tight against it while the bottom had daylight; 36 from the
 * bottom of the screen clears the home indicator, which is an overlay rather
 * than a bite out of the layout.
 *
 * Baseline, not the bottom of the text box — so the padding below is 36 less
 * the drop from baseline to box bottom, which is descent plus half-leading and
 * cannot be reasoned out of the line-height alone. Measured in the browser at
 * 14/20 Inter Semibold.
 *
 * THE BOTTOM TAKES NO INSET. An earlier version added env(safe-area-inset-*) at
 * both ends, which pushed the copy up by the height of the home indicator on top
 * of its 90 — and headless Chrome reports those insets as 0, so the measurement
 * came back exact and could not see it. If you are checking the bottom number in
 * a browser, you are checking the case where the bug is absent.
 */
export const WELCOME_EDGE = 36;
export const WELCOME_SKIP_BASELINE_DROP = 5;

/** The design's gap between the card window and the copy. */
export const WELCOME_GAP = 10;

/**
 * The transition, in milliseconds, in the order it plays.
 *
 * The copy goes first, uncovering the three posts, and the stack slides as it
 * finishes. Then
 * they slide down to where step 1 holds them, and the green ground turns black
 * as they go. Then the app around the posts and slide 1's own copy, dots and
 * Skip tutorial arrive together.
 *
 * The ground has to be black BY THE TIME the posts land, not after. Slide 1
 * fades its screenshot out at the bottom with a gradient to black; over a green
 * ground that gradient has nothing to blend into, and the result is a hard
 * green edge cutting across the third post.
 */
export const INTRO_TIMING = {
    /**
     * Welcome copy and buttons fade out. Unhurried on purpose — this is the
     * beat that reveals the third post, so it wants to be watched rather than
     * got through.
     */
    fade: 320,
    /** The card stack slides down to where step 1 holds it. */
    slide: 700,
    /**
     * Ground to black, app chrome, slide-1 copy, dots and Skip tutorial.
     *
     * By far the longest of the three, and deliberately so: it is carrying the
     * whole page from one screen to the other, and the posts underneath do not
     * move while it runs.
     */
    reveal: 1920,
} as const;

/** Cumulative start times from the tap, so the phases are declared once. */
export const INTRO_START = {
    fade: 0,
    slide: INTRO_TIMING.fade,
    reveal: INTRO_TIMING.fade + INTRO_TIMING.slide,
} as const;

/**
 * Easing, one curve per direction rather than linear throughout.
 *
 * Something leaving accelerates away, something arriving decelerates in, and
 * the thing that both starts and stops does both. Linear opacity is defensible
 * on its own, but here the three phases run back to back and matching curves
 * are what makes them read as one movement instead of three cues.
 */
export const INTRO_EASE = {
    out: "easeIn" as const,
    /**
     * An exponential ease-OUT: away immediately, then a long settle.
     *
     * No ease-in at all. The stack is already on screen and already the thing
     * being watched, so it does not need winding up — it needs to look like it
     * was let go of. Roughly two thirds of the travel happens in the first
     * quarter of the duration and the rest is the landing.
     *
     * The third post's fade rides this same curve, so it empties out fast and
     * then holds near zero while the stack settles.
     */
    slide: [0.16, 1, 0.3, 1] as [number, number, number, number],
    /**
     * The third post's fade: a quartic ease-IN, the opposite shape to the slide
     * it runs alongside.
     *
     * The post stays legible for most of the move and then goes in a hurry at
     * the end. Sharing the slide's ease-out had it half gone before the stack
     * had really travelled, which read as the post being taken away rather than
     * bowing out.
     */
    tail: [0.7, 0, 0.84, 0] as [number, number, number, number],
    in: "easeOut" as const,
};

export const INTRO_TOTAL = INTRO_START.reveal + INTRO_TIMING.reveal;

/**
 * The carousel's own delay before it reveals itself.
 *
 * Measured from when IT mounts, which is the start of the slide — not from the
 * tap. The copy has already gone by then, so INTRO_START.reveal would wait out
 * that fade a second time.
 */
export const CAROUSEL_REVEAL_DELAY = INTRO_TIMING.slide;

/** The carousel's whole intro, from its own mount. */
export const CAROUSEL_INTRO_TOTAL = INTRO_TIMING.slide + INTRO_TIMING.reveal;

/**
 * Where the third post begins within the cards band, as a fraction of it.
 *
 * Taken from the middle of the gap above the card rather than its top edge, so
 * covering it leaves no sliver of card behind.
 */
export const THIRD_POST_TOP = (612 - STEP1.cardsTop) / (STEP1.cardsBottom - STEP1.cardsTop);
