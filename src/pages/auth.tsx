import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Mail01 } from "@untitledui/icons";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { SocialButton } from "@/components/base/buttons/social-button";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { validateRedirect } from "@/utils/validate-redirect";

type Mode = "signup" | "signin";

// Brand-green CTA (dark on-brand text), matching the app's other primary buttons.
const PRIMARY_BTN =
    "flex h-9 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
// Field fill matches the design (lighter than the page) — overrides the base Input's bg-primary.
const FIELD_WRAPPER = "bg-tertiary ring-neutral-600";
// The design uses a white Google button even in dark mode (standard Google branding);
// the app is dark-only, so force the light treatment with important overrides.
const GOOGLE_BTN = "w-full !bg-white !text-gray-700 !ring-1 !ring-black/10 hover:!bg-gray-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

/**
 * Combined auth screen (design 149:1168): a "Sign up | Sign in" segmented toggle
 * switches between the two states in place. Sign up adds a Confirm password field;
 * sign in shows Remember / Forgot password. Both routes (/signup, /signin) render
 * this — the initial tab comes from the path.
 */
export function AuthScreen() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [mode, setMode] = useState<Mode>(pathname.includes("signin") ? "signin" : "signup");
    const isSignup = mode === "signup";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    // Persist a validated redirect target for after the auth flow completes.
    useEffect(() => {
        const redirect = validateRedirect(searchParams.get("redirect"));
        if (redirect) sessionStorage.setItem("cs_auth_redirect", redirect);
    }, [searchParams]);

    const switchMode = (next: Mode) => {
        setMode(next);
        setError(null);
    };

    const redirectAfterAuth = async (userId: string) => {
        const { data } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
        const redirect = sessionStorage.getItem("cs_auth_redirect");
        sessionStorage.removeItem("cs_auth_redirect");
        if (data) {
            navigate(redirect ?? "/feed", { replace: true });
        } else {
            if (redirect) sessionStorage.setItem("cs_auth_redirect", redirect);
            navigate("/onboarding", { replace: true });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (isSignup) {
            if (password.length < 8) {
                setError("Password must be at least 8 characters.");
                return;
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }

            setLoading(true);
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });
            setLoading(false);

            if (signUpError) {
                setError(signUpError.message);
                return;
            }
            // Supabase returns identities: [] when the email is already registered.
            if (data.user && data.user.identities?.length === 0) {
                setError("An account with this email already exists. Try signing in instead.");
                return;
            }
            // Session present → email confirmation disabled; go straight to onboarding.
            if (data.session) {
                window.location.replace("/onboarding");
                return;
            }
            setVerificationSent(true);
            return;
        }

        // Sign in
        setLoading(true);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
            setError(signInError.message);
        } else if (data.user) {
            await redirectAfterAuth(data.user.id);
        }
        setLoading(false);
    };

    const handleGoogle = async () => {
        setError(null);
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    };

    if (verificationSent) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-9 py-12">
                <div className="w-full max-w-sm text-center">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-secondary">
                        <Mail01 className="size-6 text-brand-primary" />
                    </div>
                    <h1 className="text-display-sm font-semibold text-primary">Check your email</h1>
                    <p className="mt-3 text-sm text-secondary">
                        We sent a verification link to <span className="font-semibold text-primary">{email}</span>. Click the link to
                        activate your account and complete sign-up.
                    </p>
                    <p className="mt-4 text-xs text-tertiary">
                        Didn't get it? Check your spam folder, or{" "}
                        <button
                            className="font-semibold text-brand-500 underline underline-offset-2"
                            onClick={() => setVerificationSent(false)}
                        >
                            try a different email
                        </button>
                        .
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-9 py-12">
            <div className="flex w-full max-w-sm flex-col items-center gap-6">
                {/* Header */}
                <div className="flex flex-col items-center gap-2.5 px-5 text-center">
                    <h1 className="text-display-sm font-semibold text-primary">
                        {isSignup ? "Create your account" : "Welcome back"}
                    </h1>
                    <p className="text-sm text-secondary">
                        {isSignup ? "Join CourtPlay – find a sub for your court in under 10 minutes" : "Sign in to CourtPlay"}
                    </p>
                </div>

                {/* Sign up | Sign in toggle — 36px tall (design), tabs flush; the
                    container clips the active pill's outer corners. */}
                <div className="flex w-full gap-0.5 overflow-hidden rounded-lg bg-secondary ring-1 ring-secondary ring-inset">
                    {(["signup", "signin"] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => switchMode(m)}
                            aria-pressed={mode === m}
                            className={cx(
                                "flex h-9 flex-1 items-center justify-center text-sm font-semibold transition duration-100 ease-linear",
                                mode === m ? "bg-brand-500 text-neutral-950" : "text-tertiary hover:text-secondary",
                            )}
                        >
                            {m === "signup" ? "Sign up" : "Sign in"}
                        </button>
                    ))}
                </div>

                {/* Form */}
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
                    <Input
                        label="Password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={setPassword}
                        size="sm"
                        wrapperClassName={FIELD_WRAPPER}
                    />

                    {isSignup ? (
                        <Input
                            label="Confirm password"
                            type="password"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            size="sm"
                            wrapperClassName={FIELD_WRAPPER}
                            isInvalid={confirmPassword.length > 0 && confirmPassword !== password}
                            hint={confirmPassword.length > 0 && confirmPassword !== password ? "Passwords do not match" : undefined}
                        />
                    ) : (
                        <div className="flex w-full items-center justify-between gap-3">
                            <Checkbox label="Remember for 30 days" isSelected={remember} onChange={setRemember} />
                            <Link
                                to="/forgot-password"
                                className="shrink-0 text-sm font-semibold text-brand-500 hover:text-brand-600"
                            >
                                Forgot password
                            </Link>
                        </div>
                    )}

                    {error && <p className="text-sm text-error-primary">{error}</p>}

                    {/* 32px above the CTA (mt-2 on top of the form's 24px gap). */}
                    <button type="submit" disabled={loading} className={cx(PRIMARY_BTN, "mt-2")}>
                        {loading ? <ButtonSpinner /> : isSignup ? "Sign up" : "Sign in"}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex w-full items-center gap-3">
                    <hr className="flex-1 border-tertiary" />
                    <span className="text-sm text-tertiary">or</span>
                    <hr className="flex-1 border-tertiary" />
                </div>

                {/* Google */}
                <SocialButton social="google" size="lg" className={GOOGLE_BTN} onClick={handleGoogle}>
                    {isSignup ? "Sign up with Google" : "Sign in with Google"}
                </SocialButton>

                {/* Footer — switches state in place */}
                <p className="flex items-baseline justify-center gap-1 text-sm text-tertiary">
                    {isSignup ? "Already have an account?" : "Don't have an account?"}
                    <button
                        type="button"
                        onClick={() => switchMode(isSignup ? "signin" : "signup")}
                        className="font-semibold text-brand-500 hover:text-brand-600"
                    >
                        {isSignup ? "Sign in" : "Sign up"}
                    </button>
                </p>
            </div>
        </div>
    );
}
