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
                // No profile yet, so this is a new account. Ask the server whether
                // the address is on the invite list before letting them fill in
                // three steps of onboarding and fail at the end.
                //
                // FAILS OPEN: only an explicit `false` turns someone away. The
                // trigger on public.users is the actual gate, so a network blip
                // here must not lock out an invited player.
                const { data: invited, error } = await supabase.rpc("am_i_invited");
                if (!error && invited === false) {
                    navigate("/invite-only", { replace: true, state: { email: session.user.email } });
                    return;
                }
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
