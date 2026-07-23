import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle } from "@untitledui/icons";
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

type Status = "verifying" | "ready" | "invalid";

/**
 * Password-reset completion screen. Reached from the recovery-email link sent
 * by forgot-password.tsx. The Supabase client auto-detects the recovery token
 * in the URL (detectSessionInUrl defaults to true) and emits PASSWORD_RECOVERY,
 * establishing a short-lived session under which updateUser can set the new
 * password.
 */
export function ResetPassword() {
    const navigate = useNavigate();

    const [status, setStatus] = useState<Status>("verifying");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    // Detect the recovery session the client mints from the URL. The token is
    // processed asynchronously, so we listen for the auth event and also probe
    // getSession (in case processing finished before this effect ran), and fall
    // back to "invalid" if neither yields a session — e.g. an expired/used link.
    useEffect(() => {
        let settled = false;
        const markReady = () => {
            if (!settled) {
                settled = true;
                setStatus("ready");
            }
        };

        // Supabase surfaces link errors (expired/used) as params in the URL.
        const urlHasError = /(\?|#|&)error(_code|_description)?=/.test(window.location.href);

        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
                markReady();
            }
        });

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) markReady();
        });

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                setStatus("invalid");
            }
        }, urlHasError ? 0 : 4000);

        return () => {
            sub.subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setLoading(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }
        setDone(true);
        // Brief confirmation, then into the app. ProtectedRoute routes to
        // onboarding if the account has no profile yet.
        setTimeout(() => navigate("/feed", { replace: true }), 1500);
    };

    if (status === "verifying") {
        return (
            <div className="flex h-dvh items-center justify-center bg-primary">
                <div className="size-8 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
            </div>
        );
    }

    if (status === "invalid") {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-9 py-12">
                <div className="w-full max-w-sm text-center">
                    <h1 className="text-display-sm font-semibold text-primary">Link expired</h1>
                    <p className="mt-3 text-sm text-secondary">
                        This password reset link is invalid or has already been used. Request a new one to continue.
                    </p>
                    <Link
                        to="/forgot-password"
                        className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600"
                    >
                        Request a new link
                    </Link>
                </div>
            </div>
        );
    }

    if (done) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-9 py-12">
                <div className="w-full max-w-sm text-center">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-secondary">
                        <CheckCircle className="size-6 text-brand-primary" />
                    </div>
                    <h1 className="text-display-sm font-semibold text-primary">Password updated</h1>
                    <p className="mt-3 text-sm text-secondary">Signing you in…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh flex-col items-center bg-primary px-9 py-12">
            <div className="my-auto flex w-full max-w-sm flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2.5 text-center">
                    <h1 className="text-display-sm font-semibold text-primary">Set a new password</h1>
                    <p className="text-sm text-balance text-secondary">Choose a new password for your account. Must be at least 8 characters.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
                    <Input
                        label="New password"
                        type="password"
                        placeholder="Enter your new password"
                        value={password}
                        onChange={setPassword}
                        size="sm"
                        wrapperClassName={FIELD_WRAPPER}
                    />
                    <Input
                        label="Confirm password"
                        type="password"
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        size="sm"
                        wrapperClassName={FIELD_WRAPPER}
                        isInvalid={confirmPassword.length > 0 && confirmPassword !== password}
                        hint={confirmPassword.length > 0 && confirmPassword !== password ? "Passwords do not match" : undefined}
                    />

                    {error && <p className="text-sm text-error-primary">{error}</p>}

                    <button type="submit" disabled={loading} className={cx(PRIMARY_BTN, "mt-2")}>
                        {loading ? <ButtonSpinner /> : "Update password"}
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
