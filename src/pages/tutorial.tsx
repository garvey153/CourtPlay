import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/providers/profile-provider";
import { validateRedirect } from "@/utils/validate-redirect";
import { TutorialCarousel } from "@/components/app/tutorial-carousel";
import { TutorialWelcome } from "@/components/app/tutorial-welcome";
import { TUTORIAL_SLIDES } from "@/lib/tutorial-slides";
import { INTRO_START, INTRO_TOTAL } from "@/lib/tutorial-intro";

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

    /**
     * The handover, beat by beat. Held here rather than inside either screen
     * because it IS the handover — the carousel mounts a beat before the welcome
     * screen finishes leaving, which is what lets the card stack slide from one
     * to the other while the welcome copy is still up.
     *
     *   welcome   nothing moving
     *   fading    the copy and buttons go, quickly, on a still screen
     *   sliding   carousel mounts; the stack leaves for it and slides. Nothing
     *             else moves — the posts reach their place on the screen they
     *             started from
     *   revealing the ground goes black, and the app chrome and slide-1 copy
     *             come in on top of it
     *   tour      the welcome screen is gone
     */
    const [stage, setStage] = useState<"welcome" | "fading" | "sliding" | "revealing" | "tour">(
        replay ? "tour" : "welcome",
    );

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

    /**
     * Nothing here scrolls, on either screen. Without this the welcome screen
     * rubber-bands under a drag and springs back, which reads as a broken page
     * rather than an app — reported on a device, where the copy could be pulled
     * down and let go.
     *
     * Owned by the page rather than by each screen because both are mounted at
     * once mid-transition. Two locks would each capture the other's value as
     * "before", and whichever unmounted first would restore the locked state
     * instead of the original. The carousel keeps its own for when it is used
     * standalone; nested inside this one it restores to locked, and then this
     * one restores to the real original.
     */
    useEffect(() => {
        const html = document.documentElement;
        const prev = { overflow: document.body.style.overflow, overscroll: html.style.overscrollBehavior };
        document.body.style.overflow = "hidden";
        html.style.overscrollBehavior = "none";
        return () => {
            document.body.style.overflow = prev.overflow;
            html.style.overscrollBehavior = prev.overscroll;
        };
    }, []);

    const takeTour = () => {
        setStage("fading");
        setTimeout(() => setStage("sliding"), INTRO_START.slide);
        setTimeout(() => setStage("revealing"), INTRO_START.reveal);
        setTimeout(() => setStage("tour"), INTRO_TOTAL);
    };

    return (
        <>
            {/* Mounts when the slide starts, not when the tap lands: the copy
                fades out first, on a screen that is otherwise still. */}
            {stage !== "welcome" && stage !== "fading" && (
                <TutorialCarousel
                    slides={TUTORIAL_SLIDES}
                    onSkip={finish}
                    onDone={finish}
                    intro={stage !== "tour"}
                />
            )}
            {stage !== "tour" && (
                <TutorialWelcome
                    showBand={stage === "welcome" || stage === "fading"}
                    showCopy={stage === "welcome"}
                    showGround={stage === "welcome" || stage === "fading" || stage === "sliding"}
                    onTakeTour={takeTour}
                    onSkip={finish}
                />
            )}
        </>
    );
}
