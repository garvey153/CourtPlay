import { Link } from "react-router";
import { Button } from "@/components/base/buttons/button";

const STEPS = [
    {
        number: "1",
        title: "Post your spot",
        description: "Need a sub for your game? Post the details — date, time, court, cost — and let the group know.",
    },
    {
        number: "2",
        title: "Browse open games",
        description: "Looking to play? Browse sub needs at your level, at courts near you, on dates that work.",
    },
    {
        number: "3",
        title: "Claim and play",
        description: "Claim a spot, get approved, coordinate payment via Venmo, and show up ready to play.",
    },
];

export function Landing() {
    return (
        <div className="flex min-h-dvh flex-col bg-primary">
            {/* Hero */}
            <section className="flex flex-col items-center px-6 pt-16 pb-12 text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-brand-secondary">CourtPlay</p>
                <h1 className="mt-3 max-w-md text-display-sm font-semibold text-primary sm:text-display-md">
                    Find a tennis sub in Westport in under 10 minutes.
                </h1>
                <p className="mt-4 max-w-sm text-lg text-tertiary">
                    Post your open spot or browse games at your level. Claim, coordinate, and play — all from your phone.
                </p>
                <div className="mt-8 flex gap-3">
                    <Button color="primary" size="lg" href="/signup">
                        Get started
                    </Button>
                    <Button color="secondary" size="lg" href="/signin">
                        Sign in
                    </Button>
                </div>
            </section>

            {/* How it works */}
            <section className="bg-secondary px-6 py-12">
                <h2 className="text-center text-lg font-semibold text-primary">How it works</h2>
                <div className="mx-auto mt-8 grid max-w-lg gap-8 sm:grid-cols-3 sm:max-w-3xl">
                    {STEPS.map((step) => (
                        <div key={step.number} className="flex flex-col items-center text-center">
                            <div className="flex size-10 items-center justify-center rounded-full bg-brand-solid text-lg font-bold text-white">
                                {step.number}
                            </div>
                            <h3 className="mt-3 text-base font-semibold text-primary">{step.title}</h3>
                            <p className="mt-1 text-sm text-tertiary">{step.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Social proof */}
            <section className="px-6 py-12">
                <h2 className="text-center text-lg font-semibold text-primary">Trusted by Westport tennis players</h2>
                <div className="mx-auto mt-6 grid max-w-lg gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                        <p className="text-sm text-secondary italic">
                            "Found a sub for my regular game in 5 minutes. Total game changer for our group."
                        </p>
                        <p className="mt-3 text-xs font-semibold text-tertiary">— Early member, Longshore Club</p>
                    </div>
                    <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                        <p className="text-sm text-secondary italic">
                            "Moved to Westport and had no one to play with. CourtPlay connected me with a regular doubles group in a week."
                        </p>
                        <p className="mt-3 text-xs font-semibold text-tertiary">— New resident, 4.0 NTRP</p>
                    </div>
                </div>
            </section>

            {/* CTA banner */}
            <section className="bg-brand-section px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-primary_on-brand">Ready to play?</h2>
                <p className="mt-2 text-sm text-secondary_on-brand">
                    Join CourtPlay and never miss an open court again.
                </p>
                <div className="mt-6">
                    <Button color="primary" size="lg" href="/signup">
                        Get started — it's free
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-secondary px-6 py-8 text-center">
                <p className="text-sm font-semibold text-secondary">CourtPlay</p>
                <div className="mt-3 flex justify-center gap-4">
                    <Link to="/terms" className="text-xs text-tertiary hover:text-secondary underline underline-offset-2">
                        Terms of Service
                    </Link>
                    <Link to="/privacy" className="text-xs text-tertiary hover:text-secondary underline underline-offset-2">
                        Privacy Policy
                    </Link>
                </div>
                <p className="mt-3 text-xs text-quaternary">
                    Questions? Email{" "}
                    <a href="mailto:hello@courtplay.app" className="underline underline-offset-2">
                        hello@courtplay.app
                    </a>
                </p>
                <p className="mt-2 text-xs text-quaternary">
                    &copy; {new Date().getFullYear()} CourtPlay. All rights reserved.
                </p>
            </footer>
        </div>
    );
}
