import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Mail01 } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

// Brand-green CTA (dark on-brand text), matching auth.tsx.
const PRIMARY_BTN =
    "flex h-9 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
// Field fill matches the design (lighter than the page) — overrides the base Input's bg-primary.
const FIELD_WRAPPER = "bg-tertiary ring-neutral-600";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

/**
 * Password-reset request screen. Sends a Supabase recovery email whose link
 * lands on /reset-password (see reset-password.tsx). Reached from the "Forgot
 * password" link on the sign-in screen.
 */
export function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim()) {
            setError("Enter the email address for your account.");
            return;
        }

        setLoading(true);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        setLoading(false);

        if (resetError) {
            setError(resetError.message);
            return;
        }
        // Always show the confirmation, even if the email isn't registered —
        // revealing which addresses have accounts would leak membership.
        setSent(true);
    };

    if (sent) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-9 py-12">
                <div className="w-full max-w-sm text-center">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-secondary">
                        <Mail01 className="size-6 text-brand-primary" />
                    </div>
                    <h1 className="text-display-sm font-semibold text-primary">Check your email</h1>
                    <p className="mt-3 text-sm text-secondary">
                        If an account exists for <span className="font-semibold text-primary">{email}</span>, we've sent a link to reset
                        your password. Click the link to choose a new one.
                    </p>
                    <p className="mt-4 text-xs text-tertiary">
                        Didn't get it? Check your spam folder, or{" "}
                        <button className="font-semibold text-brand-500 underline underline-offset-2" onClick={() => setSent(false)}>
                            try a different email
                        </button>
                        .
                    </p>
                    <Link
                        to="/signin"
                        className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:text-brand-600"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Back to sign in
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh flex-col items-center bg-primary px-9 py-12">
            <div className="my-auto flex w-full max-w-sm flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2.5 text-center">
                    <h1 className="text-display-sm font-semibold text-primary">Forgot password?</h1>
                    <p className="text-sm text-balance text-secondary">
                        Enter the email for your account and we'll send you a link to reset your password.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
                    <Input
                        label="Email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={setEmail}
                        size="sm"
                        wrapperClassName={FIELD_WRAPPER}
                    />

                    {error && <p className="text-sm text-error-primary">{error}</p>}

                    <button type="submit" disabled={loading} className={cx(PRIMARY_BTN, "mt-2")}>
                        {loading ? <ButtonSpinner /> : "Send reset link"}
                    </button>
                </form>

                <Link
                    to="/signin"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:text-brand-600"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back to sign in
                </Link>
            </div>
        </div>
    );
}
