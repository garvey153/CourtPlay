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
    /** Where the tab bar starts, cutting off the third card. */
    cardsBottom: 776,
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
 * 90 from the top of the screen to the top of the first card, and the BASELINE
 * of Skip for now 90 from the bottom. The card window takes everything left
 * over, so a taller phone shows more posts rather than more empty ground.
 *
 * Baseline, not the bottom of the text box — so the padding below is 90 less
 * the drop from baseline to box bottom, which is descent plus half-leading and
 * cannot be reasoned out of the line-height alone. Measured in the browser at
 * 14/20 Inter Semibold, the way the invite-only screen's spacing was.
 *
 * 90 FROM THE SCREEN EDGE, not from the safe area. An earlier version added
 * env(safe-area-inset-bottom) on top, which put the copy 124px up on a phone
 * with a home indicator — and headless Chrome reports those insets as 0, so the
 * measurement came back a clean 90 and could not see it. If you are checking
 * this number in a browser, you are checking the case where the bug is absent.
 */
export const WELCOME_EDGE = 90;
export const WELCOME_SKIP_BASELINE_DROP = 5;

/** The design's gap between the card window and the copy. */
export const WELCOME_GAP = 10;

/**
 * The transition, in milliseconds, in the order it plays.
 *
 * Posts first, while the welcome copy is still up: they slide down to where
 * step 1 holds them, passing over the copy. Then the copy goes. Then everything
 * that makes it the tutorial — the black ground, the app chrome around the
 * posts, and slide 1's own copy, dots and Skip tutorial — arrives together.
 *
 * The order is why the copy cannot live in the same layer as the card stack:
 * the stack has to leave that layer and join the carousel while the copy is
 * still on screen. See TutorialWelcome.
 */
export const INTRO_TIMING = {
    /** The card stack slides down to where step 1 holds it. */
    slide: 300,
    /** Welcome copy and buttons fade out. */
    fade: 180,
    /** Black ground, app chrome, slide-1 copy, dots and Skip tutorial. */
    reveal: 260,
} as const;

/** Cumulative start times, so the phases are declared once and read the same. */
export const INTRO_START = {
    slide: 0,
    fade: INTRO_TIMING.slide,
    reveal: INTRO_TIMING.slide + INTRO_TIMING.fade,
} as const;

export const INTRO_TOTAL = INTRO_START.reveal + INTRO_TIMING.reveal;
