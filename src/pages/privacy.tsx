import { XClose } from "@untitledui/icons";
import { Link, useNavigate } from "react-router";

// Green section header, grey sub-label, white body paragraph, and bullet list —
// matching the design's type hierarchy.
function Heading({ children }: { children: React.ReactNode }) {
    return <h2 className="text-sm font-semibold text-brand-500">{children}</h2>;
}
function Label({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-tertiary">{children}</p>;
}
function Body({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-primary">{children}</p>;
}
function Bullets({ items }: { items: string[] }) {
    return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-primary">
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}

export function Privacy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-dvh bg-primary">
            <div className="mx-auto flex min-h-dvh max-w-md flex-col">
                {/* Nav */}
                <header className="flex items-center justify-between px-5 py-4">
                    <img src="/courtplay-logo.svg" alt="CourtPlay" className="h-6 w-auto" />
                    <Link
                        to="/signup"
                        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600"
                    >
                        Sign up
                    </Link>
                </header>

                {/* Content sheet */}
                <div className="relative flex-1 rounded-t-2xl bg-secondary px-5 pt-4 pb-14 shadow-xl">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        aria-label="Close"
                        className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-lg text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" />
                    </button>

                    <h1 className="pr-10 text-lg font-semibold text-primary">Privacy policy</h1>

                    <div className="mt-5 flex flex-col gap-5">
                        <Label>Last updated: June 2026</Label>

                        <section className="flex flex-col gap-2">
                            <Heading>The short version</Heading>
                            <Body>
                                CourtPlay collects the minimum information needed to connect players with subs in their local racquet
                                sports community. We don't sell your data. We don't share it with advertisers. We use it to run the app
                                and make it better.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>What we collect</Heading>
                            <Label>Information you give us</Label>
                            <Bullets
                                items={[
                                    "Name and email address when you create an account",
                                    "Your location or home court (to show you relevant nearby games)",
                                    "Sport, skill level, and availability preferences",
                                    "Posts you create (sub requests and regular game listings)",
                                ]}
                            />
                            <Label>Information we collect automatically</Label>
                            <Bullets
                                items={[
                                    "Basic usage data (which features you use, when you open the app)",
                                    "Device type and operating system",
                                    "Push notification tokens (to send you sub alerts)",
                                ]}
                            />
                            <Label>Information from others</Label>
                            <Bullets items={["If another player follows you or claims your sub request, we record that connection"]} />
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>What we don't collect</Heading>
                            <Bullets
                                items={[
                                    "Payment information (Venmo handles payments directly)",
                                    "Precise real-time GPS location",
                                    "Contacts from your phone",
                                    "Any data from third-party advertisers",
                                ]}
                            />
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>How we use it</Heading>
                            <Bullets
                                items={[
                                    "To match sub requests with available players in your area",
                                    "To send you notifications when a spot is posted or claimed",
                                    "To let you follow other players and see their activity in your feed",
                                    "To improve the app based on how people use it",
                                    "To communicate with you about your account",
                                ]}
                            />
                            <Body>
                                We do not use your data to train AI models. We do not sell it. We do not share it with third parties
                                except as described below.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Who we share it with</Heading>
                            <Label>Service providers</Label>
                            <Body>We use a small number of third-party services to run CourtPlay:</Body>
                            <Bullets
                                items={[
                                    "Supabase — database and authentication",
                                    "Resend — transactional email",
                                    "OneSignal — push notifications",
                                    "Vercel — hosting",
                                ]}
                            />
                            <Body>
                                Each provider only receives the data needed to do their job. They are contractually prohibited from
                                using it for any other purpose.
                            </Body>
                            <Label>Legal requirements</Label>
                            <Body>
                                We will disclose information if required by law or to protect the safety of our users or the public.
                            </Body>
                            <Label>Business transfers</Label>
                            <Body>
                                If CourtPlay is acquired or merges with another company, your data may transfer as part of that
                                transaction. We will notify you before that happens.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Your profile and visibility</Heading>
                            <Body>
                                By default your name, sport, skill level, and court activity are visible to other CourtPlay users in
                                your community. You can adjust this in your account settings.
                            </Body>
                            <Body>
                                Sub requests you post are visible to anyone in your CourtPlay community. Claimed or expired posts are no
                                longer visible in the public feed.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Data retention</Heading>
                            <Body>
                                We keep your account data for as long as your account is active. If you delete your account we remove
                                your personal information within 30 days. Anonymised usage data may be retained longer for product
                                improvement.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Your rights</Heading>
                            <Body>You can:</Body>
                            <Bullets
                                items={[
                                    "Access a copy of your data at any time by emailing us",
                                    "Correct inaccurate information in your account settings",
                                    "Delete your account and associated data from the app",
                                    "Opt out of marketing emails via the unsubscribe link in any email",
                                    "Opt out of push notifications in your device settings",
                                ]}
                            />
                            <Body>
                                If you are in the EU or UK, you have additional rights under GDPR including the right to data
                                portability and the right to object to processing. Contact us to exercise these rights.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Cookies and tracking</Heading>
                            <Body>
                                CourtPlay uses minimal cookies necessary to keep you logged in and remember your preferences. We do not
                                use advertising cookies or third-party tracking pixels.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Children</Heading>
                            <Body>
                                CourtPlay is not intended for users under 13. We do not knowingly collect data from children under 13.
                                If you believe a child has created an account, contact us and we will delete it promptly.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Changes to this policy</Heading>
                            <Body>
                                If we make material changes we will notify you by email or in-app notification before they take effect.
                                The date at the top of this page always reflects the most recent update.
                            </Body>
                        </section>

                        <section className="flex flex-col gap-2">
                            <Heading>Contact</Heading>
                            <p className="text-sm text-primary">
                                Questions about this policy or your data:{" "}
                                <a
                                    href="mailto:privacy@courtplay.app"
                                    className="underline underline-offset-2 hover:text-secondary"
                                >
                                    privacy@courtplay.app
                                </a>
                            </p>
                        </section>

                        <Body>
                            This privacy policy is provided for informational purposes. For a production app handling real user data,
                            have it reviewed by a qualified attorney.
                        </Body>
                    </div>
                </div>
            </div>
        </div>
    );
}
