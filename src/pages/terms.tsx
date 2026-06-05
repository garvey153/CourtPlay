import { Link } from "react-router";

export function Terms() {
    return (
        <div className="mx-auto max-w-lg px-6 py-12">
            <Link to="/" className="text-sm text-brand-secondary hover:underline">&larr; Back to CourtPlay</Link>

            <h1 className="mt-6 text-xl font-semibold text-primary">Terms of Service</h1>
            <p className="mt-1 text-xs text-tertiary">Last updated: April 2026</p>

            <div className="mt-6 space-y-6 text-sm leading-relaxed text-secondary">
                <section>
                    <h2 className="font-semibold text-primary">1. Acceptance of Terms</h2>
                    <p className="mt-2">
                        By creating an account or using CourtPlay, you agree to these Terms of Service. If you do not agree, do not use the service.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">2. Description of Service</h2>
                    <p className="mt-2">
                        CourtPlay is a platform that connects tennis players in the Westport, CT area. Users can post open spots in their games ("sub needs") and browse or claim available spots posted by others. CourtPlay facilitates introductions only — we do not organize, host, or supervise any games.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">3. User Accounts</h2>
                    <p className="mt-2">
                        You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be 18 years or older to use CourtPlay.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">4. User Conduct</h2>
                    <p className="mt-2">
                        You agree not to: post misleading or fraudulent content, harass other users, use the platform for purposes unrelated to tennis or recreation, or violate any applicable laws. CourtPlay reserves the right to suspend or terminate accounts that violate these terms.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">5. Payments</h2>
                    <p className="mt-2">
                        CourtPlay does not process payments. All payments between users (e.g., court fees, lesson costs) are arranged directly between the poster and the claimer, typically via Venmo. CourtPlay is not responsible for payment disputes.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">6. Content and Intellectual Property</h2>
                    <p className="mt-2">
                        You retain ownership of content you post. By posting, you grant CourtPlay a non-exclusive license to display your content within the platform. CourtPlay may remove content that violates these terms or community guidelines.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">7. Limitation of Liability</h2>
                    <p className="mt-2">
                        CourtPlay is provided "as is." We are not liable for injuries, disputes, or damages arising from use of the platform or participation in games arranged through CourtPlay. Use the platform at your own risk.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">8. Changes to Terms</h2>
                    <p className="mt-2">
                        We may update these terms from time to time. Continued use after changes constitutes acceptance of the new terms.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">9. Contact</h2>
                    <p className="mt-2">
                        Questions about these terms? Email us at{" "}
                        <a href="mailto:hello@courtplay.app" className="text-brand-secondary underline underline-offset-2">
                            hello@courtplay.app
                        </a>.
                    </p>
                </section>
            </div>
        </div>
    );
}
