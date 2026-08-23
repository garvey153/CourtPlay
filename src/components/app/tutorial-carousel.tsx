import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Carousel } from "@/components/application/carousel/carousel-base";
import type { CarouselApi } from "@/components/application/carousel/carousel-base";
import { cx } from "@/utils/cx";
import type { TutorialSlide } from "@/lib/tutorial-slides";
import {
    BANDS,
    CAROUSEL_CHROME_DELAY,
    CAROUSEL_REVEAL_DELAY,
    INTRO_EASE,
    INTRO_TIMING,
    STEP1_ASPECT,
    bandWindow,
} from "@/lib/tutorial-intro";
import { BandImage, CardsBand } from "./tutorial-bands";

/**
 * Slide 1 mid-assembly: the same screenshot the finished slide shows, in three
 * bands so the posts can arrive before the app around them.
 *
 * The card stack carries the shared layoutId, so Motion tweens it here from
 * wherever the welcome screen had it — this component never learns the welcome
 * screen's geometry, and the welcome screen never learns the carousel's. The
 * header and tab bar have no counterpart over there, so they simply fade up in
 * place, with the rest of the tutorial, once the stack has landed.
 */
function AssemblingSlide({ alt }: { alt: string }) {
    const arrive = {
        duration: INTRO_TIMING.chrome / 1000,
        delay: CAROUSEL_CHROME_DELAY / 1000,
        ease: INTRO_EASE.in,
    };

    return (
        <div
            className="absolute top-9 left-9 w-[330px] max-w-[calc(100%_-_4.5rem)] overflow-hidden rounded-lg"
            style={{ aspectRatio: STEP1_ASPECT }}
        >
            <motion.div
                className="absolute inset-x-0 overflow-hidden"
                style={bandWindow(BANDS.top)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={arrive}
            >
                <BandImage band={BANDS.top} />
            </motion.div>

            <CardsBand className="absolute inset-x-0" style={bandWindow(BANDS.cards)} alt={alt} />

            <motion.div
                className="absolute inset-x-0 overflow-hidden"
                style={bandWindow(BANDS.bottom)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={arrive}
            >
                <BandImage band={BANDS.bottom} />
            </motion.div>
        </div>
    );
}

/**
 * The post-onboarding tutorial: swipe through screenshots of the real app
 * (Figma 662:9864 and the five frames after it).
 *
 * Black, not bg-primary — the screenshots are the content here, and a true
 * black page lets them sit on it without a seam. The fade below has to land on
 * the same colour or it leaves a visible band, so the two move together.
 *
 * Embla, not a native overflow-x scroller. That distinction is load-bearing on
 * iOS: a flex row inside a native scroller cannot be panned with a finger (see
 * src/pages/admin/index.tsx, settled on-device across five variants). Embla
 * attaches its own pointer listeners and drives a transform inside an
 * overflow-hidden box, so the failure mode has no purchase. Verified swiping on
 * a real iPhone.
 *
 * The screenshot is deliberately cropped rather than letterboxed, and fades out
 * at whichever edge meets the copy — the design shows a phone screen running off
 * the top of the page, not a picture of a phone.
 */
export function TutorialCarousel({
    slides,
    onSkip,
    onDone,
    /**
     * Assemble slide 1 out of the welcome screen instead of just appearing.
     * The card stack is already on screen — it was the welcome screen's — so it
     * slides to where this layout holds it, the header and tab bar arrive from
     * off the top and bottom edges, and the copy follows.
     */
    intro = false,
}: {
    slides: TutorialSlide[];
    onSkip: () => void;
    onDone: () => void;
    intro?: boolean;
}) {
    const [api, setApi] = useState<CarouselApi>();
    const [index, setIndex] = useState(0);
    // Once the bands have come to rest they are pixel-identical to the whole
    // screenshot, so hand back to the plain <img>: three stacked windows are a
    // transition, not a thing to leave sitting there rounding subpixels.
    const [assembling, setAssembling] = useState(intro);

    // Step 1's framing — the crop that runs the screenshot off toward the copy
    // — only applies once the reveal starts. Before that the posts must stay
    // whole: they are the welcome screen's, they were uncropped there, and the
    // slide is a long slow move with a curve that barely shifts them for its
    // first fifth. Clipping at the handover instead put the crop on screen
    // before anything appeared to move.
    const [framed, setFramed] = useState(!intro);

    useEffect(() => {
        if (!intro) return;
        const t = setTimeout(() => setFramed(true), CAROUSEL_CHROME_DELAY);
        return () => clearTimeout(t);
    }, [intro]);

    useEffect(() => {
        if (!intro) return;
        // From this component's own mount, which is the start of the slide.
        const timer = setTimeout(() => setAssembling(false), CAROUSEL_CHROME_DELAY + INTRO_TIMING.chrome + 50);
        return () => clearTimeout(timer);
    }, [intro]);

    useEffect(() => {
        if (!api) return;
        const onSelect = () => setIndex(api.selectedScrollSnap());
        onSelect();
        api.on("select", onSelect);
        return () => {
            api.off("select", onSelect);
        };
    }, [api]);

    // Warm the next image while they read this one. These are deliberately not
    // precached, and the first view may be on cellular right after signing up.
    useEffect(() => {
        const next = slides[index + 1];
        if (next) new Image().src = next.image;
    }, [index, slides]);

    // Side swiping only, on a black document.
    //
    // index.html puts bg-primary on <body>, so anything this panel does not
    // cover — the safe areas, an overscroll bounce — showed as a lighter band
    // above and below. Painting the document black for the duration is the fix;
    // blacking out the bg-primary TOKEN would have changed the app itself.
    //
    // The overflow lock stops the page rubber-banding vertically under a drag,
    // which is the giveaway that this is a web page rather than an app.
    useEffect(() => {
        const html = document.documentElement;
        const { style } = document.body;
        const prev = {
            overflow: style.overflow,
            background: style.backgroundColor,
            overscroll: html.style.overscrollBehavior,
        };
        style.overflow = "hidden";
        style.backgroundColor = "#000";
        html.style.overscrollBehavior = "none";
        return () => {
            style.overflow = prev.overflow;
            style.backgroundColor = prev.background;
            html.style.overscrollBehavior = prev.overscroll;
        };
    }, []);

    const last = index === slides.length - 1;

    // Copy, dots and Skip come in together once the screen has finished
    // assembling. Without the intro they are simply there, so no delay applies.
    const revealTransition = intro
        ? { duration: INTRO_TIMING.reveal / 1000, delay: CAROUSEL_REVEAL_DELAY / 1000, ease: INTRO_EASE.in }
        : { duration: 0 };

    // The screenshot's own crop and bottom fade belong with the app around the
    // posts, not with the copy — the posts have to stay whole for the whole
    // slide, and a fade over an unclipped band lands across them.
    const chromeTransition = intro
        ? { duration: INTRO_TIMING.chrome / 1000, delay: CAROUSEL_CHROME_DELAY / 1000, ease: INTRO_EASE.in }
        : { duration: 0 };

    return (
        <div
            className={cx(
                "flex h-dvh flex-col gap-8 overflow-hidden overscroll-none pt-safe",
                // While the intro runs, the welcome screen's green ground is
                // still underneath and fading; painting black here would cover
                // it and turn that fade into a cut. The z-index is not decoration
                // either — the welcome screen renders after this one, so without
                // it the ground would stack on top and hide the whole carousel.
                intro ? "relative z-10 bg-transparent" : "bg-black",
            )}
        >
            <Carousel.Root setApi={setApi} className="flex min-h-0 flex-1 flex-col gap-8" opts={{ loop: false }}>
                {/* Carousel.Content puts this className on its inner track; its outer
                    viewport is h-full, so it needs a parent with a definite height. */}
                <div className="min-h-0 flex-1">
                    <Carousel.Content className="h-full" overflowHidden={framed}>
                        {slides.map((slide) => (
                            <Carousel.Item key={slide.id} className="flex h-full min-h-0 flex-col gap-8">
                                <div className={cx("relative min-h-0 flex-1", framed && "overflow-hidden")}>
                                    {assembling && slide.id === slides[0].id ? (
                                        <AssemblingSlide alt={slide.alt} />
                                    ) : (
                                        <img
                                            src={slide.image}
                                            alt={slide.alt}
                                            width={330}
                                            height={717}
                                            loading={slide.id === slides[0].id ? "eager" : "lazy"}
                                            className={cx(
                                                "absolute left-9 w-[330px] max-w-[calc(100%_-_4.5rem)] rounded-lg",
                                                // A sheet's buttons sit at the bottom of the phone, so
                                                // that end is pulled into view and the top fades out.
                                                slide.focus === "bottom" ? "bottom-0" : "top-9",
                                            )}
                                        />
                                    )}
                                    {/* Fades the screenshot into the page at the edge that
                                        meets the copy, so it reads as one surface.

                                        It arrives with the rest of step 1 rather
                                        than being there from the start. During the
                                        intro the slide area does not clip, so this
                                        sat ACROSS the posts instead of at their
                                        edge — the third one faded out halfway down
                                        and then reappeared below. */}
                                    <motion.div
                                        aria-hidden="true"
                                        className={cx(
                                            "pointer-events-none absolute inset-x-0 h-16",
                                            slide.focus === "bottom"
                                                ? "top-0 bg-gradient-to-t from-transparent to-black"
                                                : "bottom-0 bg-gradient-to-b from-transparent to-black",
                                        )}
                                        initial={intro ? { opacity: 0 } : false}
                                        animate={{ opacity: 1 }}
                                        transition={chromeTransition}
                                    />

                                    {/* The ground behind slide 1's copy, coming in
                                        WITH that copy rather than with the app
                                        around the posts. It reaches below the
                                        slide area, which is unclipped for the
                                        duration, so as it arrives it covers the
                                        third post's overhang — that is what takes
                                        the post away, instead of a crop appearing.
                                        Its own 64px of gradient at the top keeps
                                        the edge soft. */}
                                    {assembling && slide.id === slides[0].id && (
                                        <motion.div
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-x-0"
                                            style={{
                                                top: "calc(100% - 4rem)",
                                                bottom: "-100vh",
                                                backgroundImage:
                                                    "linear-gradient(to bottom, transparent 0, #000 4rem)",
                                            }}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={revealTransition}
                                        />
                                    )}
                                </div>

                                <motion.div
                                    className="flex shrink-0 flex-col gap-3 px-9"
                                    initial={intro ? { opacity: 0 } : false}
                                    animate={{ opacity: 1 }}
                                    transition={revealTransition}
                                >
                                    <h1 className="text-display-sm font-semibold text-primary">{slide.headline}</h1>
                                    <p className="text-sm text-secondary">{slide.body}</p>
                                </motion.div>
                            </Carousel.Item>
                        ))}
                    </Carousel.Content>
                </div>

                {/* Announced for screen readers, which cannot see the dots. */}
                <p className="sr-only" aria-live="polite">
                    Slide {index + 1} of {slides.length}
                </p>

                <motion.div
                    className="flex shrink-0 items-center justify-between px-9 pb-[calc(2rem_+_var(--safe-bottom))]"
                    initial={intro ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={revealTransition}
                >
                    <Carousel.IndicatorGroup className="flex items-center gap-3">
                        {slides.map((slide, i) => (
                            <Carousel.Indicator key={slide.id} index={i}>
                                <span
                                    className={cx(
                                        "block size-2 rounded-full transition-colors duration-100 ease-linear",
                                        i === index ? "bg-brand-solid" : "bg-quaternary",
                                    )}
                                />
                            </Carousel.Indicator>
                        ))}
                    </Carousel.IndicatorGroup>

                    <button
                        type="button"
                        onClick={last ? onDone : onSkip}
                        className="flex items-center gap-2 text-xs text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                    >
                        {last ? "Go to CourtPlay" : "Skip tutorial"}
                        {last && (
                            <svg width="5" height="10" viewBox="0 0 5 10" fill="none" aria-hidden="true">
                                <path
                                    d="M0.5 1L4 5L0.5 9"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </button>
                </motion.div>
            </Carousel.Root>
        </div>
    );
}
