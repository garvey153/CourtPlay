import { useEffect, useState } from "react";
import { Carousel } from "@/components/application/carousel/carousel-base";
import type { CarouselApi } from "@/components/application/carousel/carousel-base";
import { cx } from "@/utils/cx";
import type { TutorialSlide } from "@/lib/tutorial-slides";

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
}: {
    slides: TutorialSlide[];
    onSkip: () => void;
    onDone: () => void;
}) {
    const [api, setApi] = useState<CarouselApi>();
    const [index, setIndex] = useState(0);

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

    // Side swiping only. Without this the page rubber-bands vertically under a
    // drag, which is the giveaway that it is a web page rather than an app.
    useEffect(() => {
        const html = document.documentElement;
        const prevOverflow = document.body.style.overflow;
        const prevOverscroll = html.style.overscrollBehavior;
        document.body.style.overflow = "hidden";
        html.style.overscrollBehavior = "none";
        return () => {
            document.body.style.overflow = prevOverflow;
            html.style.overscrollBehavior = prevOverscroll;
        };
    }, []);

    const last = index === slides.length - 1;

    return (
        <div className="flex h-dvh flex-col gap-8 overflow-hidden overscroll-none bg-black pt-safe">
            <Carousel.Root setApi={setApi} className="flex min-h-0 flex-1 flex-col gap-8" opts={{ loop: false }}>
                {/* Carousel.Content puts this className on its inner track; its outer
                    viewport is h-full, so it needs a parent with a definite height. */}
                <div className="min-h-0 flex-1">
                    <Carousel.Content className="h-full">
                        {slides.map((slide) => (
                            <Carousel.Item key={slide.id} className="flex h-full min-h-0 flex-col gap-8">
                                <div className="relative min-h-0 flex-1 overflow-hidden">
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
                                    {/* Fades the screenshot into the page at the edge that
                                        meets the copy, so it reads as one surface. */}
                                    <div
                                        aria-hidden="true"
                                        className={cx(
                                            "pointer-events-none absolute inset-x-0 h-16",
                                            slide.focus === "bottom"
                                                ? "top-0 bg-gradient-to-t from-transparent to-black"
                                                : "bottom-0 bg-gradient-to-b from-transparent to-black",
                                        )}
                                    />
                                </div>

                                <div className="flex shrink-0 flex-col gap-3 px-9">
                                    <h1 className="text-display-sm font-semibold text-primary">{slide.headline}</h1>
                                    <p className="text-sm text-secondary">{slide.body}</p>
                                </div>
                            </Carousel.Item>
                        ))}
                    </Carousel.Content>
                </div>

                {/* Announced for screen readers, which cannot see the dots. */}
                <p className="sr-only" aria-live="polite">
                    Slide {index + 1} of {slides.length}
                </p>

                <div className="flex shrink-0 items-center justify-between px-9 pb-[calc(2rem_+_var(--safe-bottom))]">
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
                </div>
            </Carousel.Root>
        </div>
    );
}
