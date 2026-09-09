/**
 * Closed beta switch.
 *
 * `VITE_INVITE_ONLY=true` turns the marketing page's calls to action from "Sign
 * up" into "Sign in" and points the installed PWA at sign-in rather than create-
 * account. It changes nothing else: every section, headline and card on the
 * landing page stays exactly as designed, so ending the beta is this one
 * variable and a redeploy rather than restoring a page from history.
 *
 * It is NOT the gate. The server refuses to create a profile for an address that
 * is not on the invite list, whatever the browser does. This only decides what
 * the app advertises.
 *
 * Build-time, like the other four VITE_* vars. Flipping it needs a redeploy,
 * which is the right shape for something that changes once at the end of a beta.
 */
export const INVITE_ONLY = import.meta.env.VITE_INVITE_ONLY === "true";

/** Where the landing page and the installed PWA send someone who taps through. */
export const ENTRY_ROUTE = INVITE_ONLY ? "/signin" : "/signup";

/**
 * Whether someone arrived from an invite email, and so should be offered the
 * sign-up form at all.
 *
 * The invite links to `/signup?invite=<token>`, and during the beta that
 * parameter is the only thing separating an invited player from someone who
 * typed the URL. Without it the auth screen is sign-in and nothing else — no
 * toggle, no "don't have an account?". The older `?email=<address>` shape still
 * works, because invites sent before the token existed are in people's inboxes.
 *
 * THIS IS A VISIBILITY MARKER, NOT A SECURITY ONE. Anyone can add either
 * parameter by hand, and it buys them nothing: they can fill in the form,
 * authenticate, and still land on /invite-only with no profile created, because
 * the trigger on public.users is what actually decides.
 *
 * The token exists for DELIVERABILITY, not secrecy. This comment used to say a
 * per-invite token was only worth adding if the sign-up form became something
 * worth hiding — still true, and still not the reason. The reason is that a
 * clickable link to an account-creation page carrying the recipient's own email
 * address is the shape of a credential-harvest message, and it was costing the
 * invites their place in the inbox. Whatever is stored here is an ADDRESS
 * either way: the token is resolved before it reaches this module.
 */
const INVITE_LINK_KEY = "cs_invite_email";

/**
 * Persisted because the marker has to survive the round trip to Google and back,
 * a reload, and a return to the tab an hour later. An invited player who lost it
 * mid-flow would be stranded on a sign-in-only screen with no account to sign in
 * to — the one failure this whole change must not create.
 */
export function rememberInviteLink(email: string | null | undefined): void {
    if (!email) return;
    try {
        localStorage.setItem(INVITE_LINK_KEY, email);
    } catch {
        // Private browsing / storage disabled. The parameter still works for
        // this navigation, which is the common case.
    }
}

export function rememberedInviteEmail(): string | null {
    try {
        return localStorage.getItem(INVITE_LINK_KEY);
    } catch {
        return null;
    }
}

/** Cleared once they have a profile — the invite has served its purpose. */
export function forgetInviteLink(): void {
    try {
        localStorage.removeItem(INVITE_LINK_KEY);
    } catch {
        // As above.
    }
}
