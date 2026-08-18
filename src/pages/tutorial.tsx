import { useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/providers/profile-provider";
import { validateRedirect } from "@/utils/validate-redirect";
import { TutorialCarousel } from "@/components/app/tutorial-carousel";
import { TUTORIAL_SLIDES } from "@/lib/tutorial-slides";

/**
 * The tutorial, shown once straight after onboarding.
 *
 * ON THE DEEP LINK: onboarding used to end with
 * `navigate(sessionStorage.getItem("cs_auth_redirect") ?? "/feed")`. That value
 * is a shared /post/:id someone opened before signing in, and putting a screen
 * in front of it is exactly where such a link gets dropped. So onboarding now
 * navigates here and leaves the key alone; this screen consumes it, on exit
 * rather than on mount — an abandoned tutorial still honours the link next
 * time. It is re-validated here too: validation currently happens only where
 * the key is written, and a check next to the navigate() is the one a future
 * writer cannot bypass.
 */
export function Tutorial() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { profile, setProfile } = useProfile();

    const replay = searchParams.has("replay");

    // Resolved once: the destination must not change under them mid-swipe.
    const next = useRef(
        replay ? "/profile/edit" : (validateRedirect(sessionStorage.getItem("cs_auth_redirect")) ?? "/feed"),
    ).current;

    // Already seen it, and not deliberately replaying. This is what makes the
    // route idempotent — reloading it, or hitting back into it, moves you on
    // instead of trapping you in the tutorial again.
    if (!replay && profile?.tutorial_seen_at) {
        return <Navigate to={next} replace />;
    }

    const finish = () => {
        sessionStorage.removeItem("cs_auth_redirect");
        // Navigate FIRST. This is the last screen of signing up, and a slow
        // network must not make Done feel broken. If the write fails the worst
        // case is seeing the tutorial once more, which beats a hung button.
        navigate(next, { replace: true });

        if (!user) return;
        const seenAt = new Date().toISOString();
        if (profile) setProfile({ ...profile, tutorial_seen_at: seenAt });
        void supabase.from("users").update({ tutorial_seen_at: seenAt }).eq("id", user.id);
    };

    return <TutorialCarousel slides={TUTORIAL_SLIDES} onSkip={finish} onDone={finish} />;
}
