import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { SocialButton } from "@/components/base/buttons/social-button";
import { Input } from "@/components/base/input/input";
import { supabase } from "@/lib/supabase";
import { validateRedirect } from "@/utils/validate-redirect";

export function SignIn() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Store validated redirect param for use after auth flow completes
    useEffect(() => {
        const redirect = validateRedirect(searchParams.get("redirect"));
        if (redirect) sessionStorage.setItem("cs_auth_redirect", redirect);
    }, [searchParams]);

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

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
        } else if (data.user) {
            await redirectAfterAuth(data.user.id);
        }
        setLoading(false);
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    };

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-4 py-12">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <h1 className="text-display-xs font-semibold text-primary">Welcome back</h1>
                    <p className="mt-2 text-sm text-tertiary">Sign in to CourtPlay</p>
                </div>

                <SocialButton social="google" size="lg" className="w-full" onClick={handleGoogleSignIn}>
                    Sign in with Google
                </SocialButton>

                <div className="my-6 flex items-center gap-3">
                    <hr className="flex-1 border-secondary" />
                    <span className="text-xs text-tertiary">or</span>
                    <hr className="flex-1 border-secondary" />
                </div>

                <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
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
                        placeholder="••••••••"
                        value={password}
                        onChange={(v) => setPassword(v)}
                        isRequired
                    />

                    {error && <p className="text-sm text-error-primary">{error}</p>}

                    <Button type="submit" color="primary" size="lg" isLoading={loading} showTextWhileLoading className="w-full">
                        Sign in
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-tertiary">
                    Don't have an account?{" "}
                    <Link to="/signup" className="font-semibold text-brand-secondary hover:text-brand-secondary_hover">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}
