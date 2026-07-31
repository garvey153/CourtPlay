import { useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { LoadingState } from "@/components/application/loading-indicator/spinner";

export function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session?.user) {
                navigate("/signin", { replace: true });
                return;
            }
            const { data } = await supabase.from("users").select("id").eq("id", session.user.id).maybeSingle();
            // Check for redirect param stored before auth flow
            const redirect = sessionStorage.getItem("cs_auth_redirect");
            sessionStorage.removeItem("cs_auth_redirect");
            if (data) {
                navigate(redirect ?? "/feed", { replace: true });
            } else {
                // Store redirect for after onboarding
                if (redirect) sessionStorage.setItem("cs_auth_redirect", redirect);
                navigate("/onboarding", { replace: true });
            }
        });
    }, [navigate]);

    return (
        <LoadingState variant="screen" />
    );
}
