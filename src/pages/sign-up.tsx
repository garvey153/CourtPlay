import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Mail01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { SocialButton } from "@/components/base/buttons/social-button";
import { Input } from "@/components/base/input/input";
import { supabase } from "@/lib/supabase";
import { validateRedirect } from "@/utils/validate-redirect";

export function SignUp() {
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState("");

    // Store validated redirect param for use after auth flow completes
    useEffect(() => {
        const redirect = validateRedirect(searchParams.get("redirect"));
        if (redirect) sessionStorage.setItem("cs_auth_redirect", redirect);
    }, [searchParams]);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    const handleEmailSignUp = async (e: React.FormEvent) => {
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

        // Supabase returns identities: [] when the email is already registered
        // (prevents email enumeration but we can still detect and warn)
        if (data.user && data.user.identities?.length === 0) {
            setError("An account with this email already exists. Try signing in instead.");
            return;
        }

        // If a session was returned, email confirmation is disabled — go straight to onboarding
        if (data.session) {
            window.location.replace("/onboarding");
            return;
        }

        // Email confirmation required — show check-your-email screen
        setVerificationSent(true);
    };

    const handleGoogleSignUp = async () => {
        setError(null);
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    };

    if (verificationSent) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-4 py-12">
                <div className="w-full max-w-sm text-center">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-secondary">
                        <Mail01 className="size-6 text-brand-primary" />
                    </div>
                    <h1 className="text-display-xs font-semibold text-primary">Check your email</h1>
                    <p className="mt-3 text-sm text-tertiary">
                        We sent a verification link to{" "}
                        <span className="font-semibold text-secondary">{email}</span>.
                        Click the link to activate your account and complete sign-up.
                    </p>
                    <p className="mt-4 text-xs text-tertiary">
                        Didn't get it? Check your spam folder, or{" "}
                        <button
                            className="font-semibold text-brand-secondary underline underline-offset-2"
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
        <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-4 py-12">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <h1 className="text-display-xs font-semibold text-primary">Create your account</h1>
                    <p className="mt-2 text-sm text-tertiary">Join CourtPlay — find a tennis sub in Westport in under 10 minutes.</p>
                </div>

                <SocialButton social="google" size="lg" className="w-full" onClick={handleGoogleSignUp}>
                    Sign up with Google
                </SocialButton>

                <div className="my-6 flex items-center gap-3">
                    <hr className="flex-1 border-secondary" />
                    <span className="text-xs text-tertiary">or</span>
                    <hr className="flex-1 border-secondary" />
                </div>

                <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
                    <Input
                        label="Email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(v) => setEmail(v)}
                        isRequired
                    />
                    <Input
                        label="Password"
                        type="password"
                        placeholder="Create a password (8+ characters)"
                        value={password}
                        onChange={(v) => setPassword(v)}
                        isRequired
                    />
                    <Input
                        label="Confirm password"
                        type="password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(v) => setConfirmPassword(v)}
                        isRequired
                        isInvalid={confirmPassword.length > 0 && confirmPassword !== password}
                        hint={confirmPassword.length > 0 && confirmPassword !== password ? "Passwords do not match" : undefined}
                    />

                    {error && <p className="text-sm text-error-primary">{error}</p>}

                    <Button
                        type="submit"
                        color="primary"
                        size="lg"
                        isLoading={loading}
                        showTextWhileLoading
                        className="w-full"
                    >
                        Create account
                    </Button>
                </form>

                <p className="mt-4 text-center text-xs text-tertiary">
                    By creating an account, you agree to our{" "}
                    <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link>
                    {" "}and{" "}
                    <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
                </p>

                <p className="mt-4 text-center text-sm text-tertiary">
                    Already have an account?{" "}
                    <Link to="/signin" className="font-semibold text-brand-secondary hover:text-brand-secondary_hover">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
