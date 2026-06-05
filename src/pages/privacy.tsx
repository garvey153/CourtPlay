import { Link } from "react-router";

export function Privacy() {
    return (
        <div className="mx-auto max-w-lg px-6 py-12">
            <Link to="/" className="text-sm text-brand-secondary hover:underline">&larr; Back to CourtPlay</Link>

            <h1 className="mt-6 text-xl font-semibold text-primary">Privacy Policy</h1>
            <p className="mt-1 text-xs text-tertiary">Last updated: April 2026</p>

            <div className="mt-6 space-y-6 text-sm leading-relaxed text-secondary">
                <section>
                    <h2 className="font-semibold text-primary">1. Information We Collect</h2>
                    <p className="mt-2">When you create a CourtPlay account, we collect:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li><strong>Email address</strong> — for authentication and notifications.</li>
                        <li><strong>Name</strong> — displayed to other users on your profile and posts.</li>
                        <li><strong>Phone number</strong> (optional) — shared only with approved claimers for game coordination. Encrypted at rest.</li>
                        <li><strong>Venmo handle</strong> (optional) — shared only with approved claimers for payment coordination. Encrypted at rest.</li>
                        <li><strong>Skill level and court preferences</strong> — used for matching and displayed on your profile.</li>
                        <li><strong>Profile photo</strong> — from your Google account if you sign in with Google.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">2. How We Use Your Information</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>To provide the CourtPlay service: matching posters with claimers.</li>
                        <li>To send notifications about claims, approvals, and game reminders (email and push).</li>
                        <li>To display your public profile to other authenticated users.</li>
                        <li>To detect and prevent abuse via the reporting system.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">3. Information Sharing</h2>
                    <p className="mt-2">We do not sell your personal information. We share data only in these cases:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li><strong>With other users</strong> — your name, skill level, and profile photo are visible to authenticated users. Your phone and Venmo handle are shared only with users whose claims you approve.</li>
                        <li><strong>With service providers</strong> — we use Supabase (database), Resend (email), and OneSignal (push notifications) to operate the platform.</li>
                        <li><strong>As required by law</strong> — we may disclose information in response to legal requests.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">4. Data Security</h2>
                    <p className="mt-2">
                        Sensitive fields (phone number, Venmo handle) are encrypted at rest using AES encryption. Authentication is handled by Supabase Auth with secure session management. All data is transmitted over HTTPS.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">5. Your Rights</h2>
                    <p className="mt-2">You can:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Update your profile information at any time.</li>
                        <li>Manage your notification preferences in Settings.</li>
                        <li>Request deletion of your account and personal data by emailing us.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">6. Data Retention</h2>
                    <p className="mt-2">
                        We retain your data for as long as your account is active. Post and claim history is preserved for community trust purposes even after account deletion, but personal details (name, phone, Venmo) are anonymized.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">7. Cookies and Analytics</h2>
                    <p className="mt-2">
                        CourtPlay uses essential cookies for authentication. We do not use third-party tracking or advertising cookies.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">8. Changes to This Policy</h2>
                    <p className="mt-2">
                        We may update this policy from time to time. We will notify you of significant changes via email.
                    </p>
                </section>

                <section>
                    <h2 className="font-semibold text-primary">9. Contact</h2>
                    <p className="mt-2">
                        Questions about your data? Email us at{" "}
                        <a href="mailto:hello@courtplay.app" className="text-brand-secondary underline underline-offset-2">
                            hello@courtplay.app
                        </a>.
                    </p>
                </section>
            </div>
        </div>
    );
}
