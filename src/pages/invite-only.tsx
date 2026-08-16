import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { PRIMARY_H9_FULL as PRIMARY_BTN } from "@/components/base/buttons/button-styles";

/**
 * Where someone lands when they signed in successfully but their address is not
 * on the invite list (Figma 662:4309).
 *
 * It names the address that was checked. The gate is keyed on email, so the one
 * genuinely confusing failure is being invited at one address and signing in
 * with another — a work address versus a personal Google account. Showing which
 * one we looked at turns "it doesn't work" into something the person can fix
 * themselves. There is no contact link — the domain cannot receive mail — so the
 * two ways out are trying another account or going back to the marketing page.
 *
 * The session is cleared on arrival: leaving someone signed in but unable to do
 * anything is worse than signing them out, and a stale session would send them
 * back through the same loop on every reload.
 */
export function InviteOnly() {
    const location = useLocation();
    const emailFromState = (location.state as { email?: string } | null)?.email;
    const [email, setEmail] = useState<string | undefined>(emailFromState);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Read the address before signing out — after, there is no session to
            // ask. Skipped when the caller already passed it in.
            if (!emailFromState) {
                const { data } = await supabase.auth.getUser();
                if (!cancelled && data.user?.email) setEmail(data.user.email);
            }
            await supabase.auth.signOut();
        })();
        return () => {
            cancelled = true;
        };
    }, [emailFromState]);

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-8">
            {/* Left-aligned inside a centred column: the design sets the text ragged
                right at 402px, and capping the width keeps the 36px headline from
                running the full width of a desktop window. */}
            <div className="flex w-full max-w-sm flex-col gap-3">
                <h1 className="text-display-md font-semibold text-primary">CourtPlay is invite only, for now.</h1>

                <div className="text-sm text-secondary">
                    <p>
                        CourtPlay is in a closed beta with a small group of players. We couldn&apos;t find an invite for
                        {email ? "" : " that account."}
                    </p>
                    {email && <p className="text-primary">{email}</p>}
                </div>

                <p className="text-sm text-secondary">
                    Invited at a different address? Sign in with that one instead.
                </p>

                <div className="flex w-full flex-col gap-4 pt-4">
                    <Link to="/signin" className={PRIMARY_BTN}>
                        Try another account
                    </Link>
                    <Link
                        to="/"
                        className="text-center text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                    >
                        Back to CourtPlay
                    </Link>
                </div>
            </div>
        </div>
    );
}
