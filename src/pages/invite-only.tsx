import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Mail01 } from "@untitledui/icons";
import { supabase } from "@/lib/supabase";
import { PRIMARY_H9_FULL as PRIMARY_BTN } from "@/components/base/buttons/button-styles";

/**
 * Where someone lands when they signed in successfully but their address is not
 * on the invite list.
 *
 * It names the address that was checked. The gate is keyed on email, so the one
 * genuinely confusing failure is being invited at one address and signing in
 * with another — a work address versus a personal Google account. Showing which
 * one we looked at turns "it doesn't work" into something the person can fix
 * themselves, and gives them something concrete to quote when they write in.
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
        <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-9 py-12">
            <div className="w-full max-w-sm text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-secondary">
                    <Mail01 className="size-6 text-brand-primary" />
                </div>
                <h1 className="text-display-sm font-semibold text-primary">Invite only, for now</h1>
                <p className="mt-3 text-sm text-secondary">
                    CourtPlay is in a closed beta with a small group of players. We couldn't find an invite for{" "}
                    {email ? <span className="font-semibold text-primary">{email}</span> : "that account"}.
                </p>
                <p className="mt-3 text-sm text-secondary">
                    Invited at a different address? Sign in with that one instead.
                </p>

                <div className="mt-6 flex flex-col gap-3">
                    <Link to="/signin" className={PRIMARY_BTN}>
                        Try another account
                    </Link>
                    <a
                        href={`mailto:hello@courtplay.app?subject=${encodeURIComponent("CourtPlay beta invite")}`}
                        className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                    >
                        Ask for an invite
                    </a>
                </div>
            </div>
        </div>
    );
}
