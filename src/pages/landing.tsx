import { Link } from "react-router";

// Green CTA (dark on-brand text), matching the app's other primary buttons.
const PRIMARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600";

// Static preview cards for the hero — mirrors the feed SubCard styling.
const SAMPLE = {
    title: "Doubles Tennis · Sat 9:00am",
    subtitle: "Longshore Club · NTRP 2.5 · 2 hrs",
    poster: "Chris B.",
    when: "20m ago",
    price: "$25",
};

function PreviewCard() {
    return (
        <div className="flex overflow-hidden rounded">
            <span className="w-1 shrink-0 self-stretch bg-brand-500" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 bg-secondary p-4">
                <div className="flex w-full items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="text-md font-semibold text-primary">{SAMPLE.title}</p>
                        <p className="text-xs text-secondary">{SAMPLE.subtitle}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-800 px-2 py-1 text-xs font-semibold text-brand-500">
                        <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                        Open
                    </span>
                </div>
                <div className="flex w-full items-center justify-between pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-neutral-950 shadow-xs">
                            {SAMPLE.poster.charAt(0)}
                        </span>
                        <span className="truncate text-xs text-tertiary">
                            {SAMPLE.poster} · {SAMPLE.when}
                        </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">{SAMPLE.price}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Marketing landing page shown when visiting CourtPlay on the web (design 149:1164).
 * The installed PWA skips this — see the "/" route, which redirects to /signup when
 * running standalone.
 */
export function Landing() {
    return (
        <div className="min-h-dvh bg-primary">
            <div className="mx-auto flex min-h-dvh max-w-md flex-col">
                {/* Nav */}
                <header className="flex items-center justify-between px-5 py-4">
                    <img src="/courtplay-logo.svg" alt="CourtPlay" className="h-6 w-auto" />
                    <Link to="/signup" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600">
                        Sign up
                    </Link>
                </header>

                {/* Hero */}
                <section className="mt-8 flex flex-col gap-2.5 px-5">
                    <h1 className="text-display-md font-semibold tracking-tight text-primary">
                        All racquets.
                        <br />
                        No empty courts.
                    </h1>
                    <p className="text-sm text-secondary">
                        CourtPlay instantly connects you with available players in your area. No more group texts.
                    </p>
                </section>

                {/* Preview cards */}
                <section className="mt-8 flex flex-col gap-3 px-5">
                    <PreviewCard />
                    <PreviewCard />
                    <PreviewCard />
                </section>

                {/* CTA */}
                <section className="mt-8 flex flex-col items-center gap-6 bg-secondary px-5 py-8 text-center">
                    <div className="flex flex-col items-center gap-2.5 px-7">
                        <h2 className="text-display-sm font-semibold text-balance text-primary">Ready to find your next match?</h2>
                        <p className="text-sm text-secondary">Join players near you already using CourtPlay.</p>
                    </div>
                    <Link to="/signup" className={PRIMARY_BTN}>
                        Get started – it's free!
                    </Link>
                </section>

                {/* Footer */}
                <footer className="mt-8 flex flex-col items-center gap-2.5 px-5 pt-6 pb-8">
                    <img src="/courtplay-logo.svg" alt="CourtPlay" className="h-3.5 w-auto opacity-90" />
                    <div className="flex items-center gap-2 text-xs text-tertiary">
                        <Link to="/privacy" className="hover:text-secondary">
                            Privacy
                        </Link>
                        <span aria-hidden="true">·</span>
                        <Link to="/terms" className="hover:text-secondary">
                            Terms
                        </Link>
                        <span aria-hidden="true">·</span>
                        <a href="mailto:hello@courtplay.app" className="hover:text-secondary">
                            Contact
                        </a>
                    </div>
                </footer>
            </div>
        </div>
    );
}
