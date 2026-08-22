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
 * The window of posts on the welcome screen, in px (Figma 675:4527 → Frame 24).
 *
 * The design's column is this, a 10px gap, then the copy, centred in the frame.
 * Everything else about the vertical rhythm falls out of that: the 54.5px above
 * the posts and below Skip for now are the leftover margins of centring 703px
 * of content in an 812px frame, not offsets to be placed.
 */
export const WELCOME_CARDS_WINDOW = 374;


/**
 * The transition, in milliseconds. "Quickly" throughout — this sits between
 * tapping a button and reading the first slide, so it has to feel like the
 * screen assembling itself rather than a cutscene.
 */
export const INTRO_TIMING = {
    /** Welcome copy and buttons fade out while the green ground turns black. */
    fade: 180,
    /** The card stack slides to where step 1 holds it, and opens up. */
    slide: 260,
    /** Header and tab bar arrive from off the top and bottom edges. */
    bands: 260,
    /** Slide-1 copy, dots and Skip tutorial arrive last. */
    reveal: 220,
} as const;

/** Cumulative start times, so the phases are declared once and read the same. */
export const INTRO_START = {
    fade: 0,
    slide: INTRO_TIMING.fade,
    bands: INTRO_TIMING.fade + INTRO_TIMING.slide,
    reveal: INTRO_TIMING.fade + INTRO_TIMING.slide + INTRO_TIMING.bands,
} as const;

export const INTRO_TOTAL = INTRO_START.reveal + INTRO_TIMING.reveal;
