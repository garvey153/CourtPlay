import { useState } from "react";
import { Link } from "react-router";
import { Avatar } from "@/components/base/avatar/avatar";
import { InstallAppButton } from "@/components/app/install-app-button";
import { cx } from "@/utils/cx";

// Hero headlines, rendered as two lines. One is picked at random on each page load.
const HEADLINES: [string, string][] = [
    ["Every match.", "No empty courts."],
    ["Love means nothing.", "Showing up means everything."],
    ["No-shows happen.", "Empty courts don't."],
    ["Rain checks, yes.", "Empty courts, no."],
    ["Nothing to love", "about a no-show."],
    ["The only thing unforced", "should be errors."],
];

// Design-system Primary button (Figma node 32:86, size M): bg/brand fill with
// on-brand text. Width is set per-usage. Token mapping: bg/brand #1ab363 →
// brand-500, bg/brand-hover #118c4a → brand-600, text/on-brand #08180e → neutral-950.
const PRIMARY_BTN =
    "flex items-center justify-center gap-1 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600";

// Static preview cards for the hero — mirrors the feed SubCard styling, with a
// mix of open games and one already claimed (dimmed, grey) for variety.
interface SamplePost {
    title: string;
    subtitle: string;
    poster: string;
    avatar: string;
    when: string;
    price: string;
    claimed?: boolean;
}

const POSTS: SamplePost[] = [
    { title: "Doubles Tennis · Sat 9:00am", subtitle: "Longshore Club · NTRP 3.5 · 2 hrs", poster: "Chris B.", avatar: "/avatars/chris.jpg", when: "20m ago", price: "$25" },
    { title: "Singles Tennis · Sun 4:30pm", subtitle: "Westport Tennis Club · NTRP 4.0 · 1.5 hrs", poster: "Maria L.", avatar: "/avatars/maria.jpg", when: "1h ago", price: "$18" },
    { title: "Point Play · Wed 6:00pm", subtitle: "Compo Beach Courts · NTRP 3.0 · 1 hr", poster: "Dan K.", avatar: "/avatars/dan.jpg", when: "3h ago", price: "$15", claimed: true },
];

function PreviewCard({ post }: { post: SamplePost }) {
    const { claimed } = post;
    const bar = claimed ? "bg-neutral-400" : "bg-brand-500";
    const strong = claimed ? "text-tertiary" : "text-primary";
    const sub = claimed ? "text-tertiary" : "text-secondary";

    return (
        <div className="flex overflow-hidden rounded">
            <span className={cx("w-1 shrink-0 self-stretch", bar)} aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 bg-secondary p-4">
                <div className="flex w-full items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className={cx("text-md font-semibold", strong)}>{post.title}</p>
                        <p className={cx("text-xs", sub)}>{post.subtitle}</p>
                    </div>
                    {claimed ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-neutral-800 px-2 py-1 text-xs font-semibold text-neutral-400">
                            <span className="size-1.5 rounded-full bg-neutral-400" aria-hidden="true" />
                            Claimed
                        </span>
                    ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-800 px-2 py-1 text-xs font-semibold text-brand-500">
                            <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                            Open
                        </span>
                    )}
                </div>
                <div className="flex w-full items-center justify-between pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                            size="xs"
                            src={post.avatar}
                            alt={post.poster}
                            initials={post.poster.charAt(0)}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <span className="truncate text-xs text-tertiary">
                            {post.poster} · {post.when}
                        </span>
                    </div>
                    <span className={cx("shrink-0 text-sm font-semibold", strong)}>{post.price}</span>
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
    // Pick once on load so it stays stable across re-renders.
    const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);

    return (
        <div className="min-h-dvh overflow-x-clip bg-primary">
            {/* Mobile keeps the narrow phone column; md widens to a roomier single
                column for tablets; from lg the container widens further and the hero
                splits into two columns so the page fills desktop screens. */}
            <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-2xl lg:max-w-6xl">
                {/* Nav */}
                <header className="flex items-center justify-between px-5 py-4 md:px-8 lg:py-6">
                    <img src="/courtplay-logo.svg" alt="CourtPlay" className="h-6 w-auto lg:h-7" />
                    <Link to="/signup" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600">
                        Sign up
                    </Link>
                </header>

                {/* Hero — stacked on mobile/tablet, two columns (copy + preview cards) on desktop */}
                <section className="mt-8 px-5 md:mt-12 md:px-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-8 lg:py-12">
                    <div className="flex flex-col gap-2.5 lg:gap-4">
                        <h1 className="text-balance text-display-md font-semibold tracking-tight text-primary md:text-display-lg lg:text-display-xl">
                            {headline[0]}
                            <br />
                            {headline[1]}
                        </h1>
                        <p className="text-sm text-secondary md:text-base lg:max-w-md lg:text-lg">
                            CourtPlay instantly connects you with available players in your area. No more group texts.
                        </p>
                        {/* Desktop only: both CTAs sit side by side in the hero. On mobile/tablet
                            the Download button moves down beside Get started in the CTA band below. */}
                        <div className="mt-2 hidden items-center gap-3 lg:flex">
                            <Link to="/signup" className={PRIMARY_BTN}>
                                Get started – it's free!
                            </Link>
                            <InstallAppButton />
                        </div>
                    </div>

                    {/* Preview cards */}
                    <div className="mt-8 flex flex-col gap-3 md:mt-10 lg:mt-0">
                        {POSTS.map((post) => (
                            <PreviewCard key={post.title} post={post} />
                        ))}
                    </div>
                </section>

                {/* CTA — full-bleed band at every breakpoint: breaks out of the centered
                    column to span the full viewport width with square edges. */}
                <section className="mt-8 mx-[calc(50%-50vw)] flex w-screen flex-col items-center gap-6 bg-secondary px-5 py-8 text-center md:mt-12 md:py-12 lg:mt-16 lg:py-14">
                    <div className="flex flex-col items-center gap-2.5 px-7">
                        <h2 className="text-display-sm font-semibold text-balance text-primary md:text-display-md lg:text-display-lg">Ready to find your next match?</h2>
                        <p className="text-sm text-secondary md:text-base lg:text-lg">Join players near you already using CourtPlay.</p>
                    </div>
                    {/* Get started, with the Download button beside it on mobile/tablet
                        (on desktop the Download button lives in the hero, so it's hidden here).
                        Narrow widths stack the two (Download second) rather than wrapping the
                        button text; from sm up they sit side by side at content width. */}
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <Link to="/signup" className={PRIMARY_BTN}>
                            Get started – it's free!
                        </Link>
                        <InstallAppButton className="lg:hidden" />
                    </div>
                </section>

                {/* Footer */}
                <footer className="mt-8 flex flex-col items-center gap-2.5 px-5 pt-6 pb-8 lg:mt-16">
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
