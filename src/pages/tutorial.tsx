import { useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/providers/profile-provider";
import { validateRedirect } from "@/utils/validate-redirect";
import { TutorialCarousel } from "@/components/app/tutorial-carousel";
import { TutorialWelcome } from "@/components/app/tutorial-welcome";
import { TUTORIAL_SLIDES } from "@/lib/tutorial-slides";
import { INTRO_TIMING } from "@/lib/tutorial-intro";

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
 *
 * THE WELCOME SCREEN comes first (Figma 675:4527) and hands over to the tour in
 * one continuous move rather than a cut — see TutorialWelcome and the carousel's
 * `intro`. Replaying from Manage skips it: "Nice work, Kate. Setup done." is
 * true exactly once, and someone who went looking for the tutorial has already
 * decided to watch it.
 */
export function Tutorial() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { profile, setProfile } = useProfile();

    const replay = searchParams.has("replay");

    // "welcome" → the copy leaves and the ground turns black → "tour", where the
    // carousel picks the card stack up mid-air. Held here rather than inside
    // either screen because it is the handover itself.
    const [stage, setStage] = useState<"welcome" | "leaving" | "tour">(replay ? "tour" : "welcome");

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

    if (stage !== "tour") {
        return (
            <TutorialWelcome
                firstName={profile?.first_name}
                leaving={stage === "leaving"}
                onTakeTour={() => {
                    setStage("leaving");
                    // The copy has to be gone before the stack starts moving, or
                    // the two motions read as one muddled one.
                    setTimeout(() => setStage("tour"), INTRO_TIMING.fade);
                }}
                onSkip={finish}
            />
        );
    }

    return <TutorialCarousel slides={TUTORIAL_SLIDES} onSkip={finish} onDone={finish} intro={!replay} />;
}
