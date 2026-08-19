import { useEffect, useState } from "react";
import { Carousel } from "@/components/application/carousel/carousel-base";
import type { CarouselApi } from "@/components/application/carousel/carousel-base";
import { cx } from "@/utils/cx";
import { PRIMARY_H9_FULL as PRIMARY_BTN } from "@/components/base/buttons/button-styles";
import type { TutorialSlide } from "@/lib/tutorial-slides";

/**
 * The post-onboarding tutorial: swipe through screenshots of the real app.
 *
 * Embla, not a native overflow-x scroller. That distinction is load-bearing on
 * iOS: a flex row inside a native scroller cannot be panned with a finger
 * (settled on-device across five variants — see src/pages/admin/index.tsx).
 * Embla attaches its own pointer listeners and drives a transform, with
 * overflow-hidden, so that failure mode has no purchase here. If it turns out
 * to misbehave on a real iPhone anyway, only the Carousel.* layer needs
 * replacing — with `overflow-x-auto whitespace-nowrap snap-x` and inline-block
 * slides, which is the shape proven to work in this codebase.
 *
 * Skip and Done live OUTSIDE Carousel.Root deliberately: inside the drag
 * region, a tap that moves a few pixels reads as a drag and the button never
 * fires.
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

    const last = index === slides.length - 1;

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-primary">
            <div className="flex justify-end px-5 pt-[calc(0.75rem_+_env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={onSkip}
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Skip
                </button>
            </div>

            <Carousel.Root setApi={setApi} className="flex min-h-0 flex-1 flex-col" opts={{ loop: false }}>
                {/* Only Carousel.Content is draggable — Root is just context, so
                    the dots and Done below sit inside it without a tap being
                    swallowed by a few pixels of drag. */}
                {/* Carousel.Content puts this className on its inner track; its
                    outer viewport is h-full, so it needs a parent with a definite
                    height or the slides grow past the screen and push the copy
                    out from under the dots. */}
                <div className="min-h-0 flex-1">
                    <Carousel.Content className="h-full">
                    {slides.map((slide) => (
                        <Carousel.Item key={slide.id} className="flex h-full min-h-0 flex-col">
                            <div className="flex min-h-0 flex-1 items-center justify-center px-9 pt-2">
                                <img
                                    src={slide.image}
                                    alt={slide.alt}
                                    width={390}
                                    height={844}
                                    loading={slide.id === slides[0].id ? "eager" : "lazy"}
                                    className="max-h-full w-auto rounded-xl object-contain"
                                />
                            </div>
                            <div className="flex shrink-0 flex-col gap-2 px-9 pt-6">
                                <h1 className="text-display-xs font-semibold text-primary">{slide.headline}</h1>
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

                <div className="flex flex-col gap-5 px-9 pt-6 pb-[calc(2rem_+_var(--safe-bottom))]">
                <Carousel.IndicatorGroup className="flex items-center justify-center" aria-label="Choose a slide">
                    {slides.map((slide, i) => (
                        <Carousel.Indicator key={slide.id} index={i} className="p-2">
                            <span
                                className={cx(
                                    "block size-2 rounded-full transition-colors duration-100 ease-linear",
                                    i === index ? "bg-brand-solid" : "bg-tertiary",
                                )}
                            />
                        </Carousel.Indicator>
                    ))}
                </Carousel.IndicatorGroup>

                {last ? (
                    <button type="button" onClick={onDone} className={PRIMARY_BTN}>
                        Done
                    </button>
                    ) : (
                        // Reserve the row so the dots don't jump when Done appears.
                        <div className="h-9" aria-hidden="true" />
                    )}
                </div>
            </Carousel.Root>
        </div>
    );
}
