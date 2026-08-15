/**
 * Closed beta switch.
 *
 * `VITE_INVITE_ONLY=true` turns the marketing page's calls to action from "Sign
 * up" into "Sign in" and points the installed PWA at sign-in rather than create-
 * account. It changes nothing else: every section, headline and card on the
 * landing page stays exactly as designed, so ending the beta is this one
 * variable and a redeploy rather than restoring a page from history.
 *
 * It is NOT the gate. Anyone can still reach /signup — the invite email links
 * there — and the server refuses to create a profile for an address that is not
 * on the invite list. This only decides what the page advertises.
 *
 * Build-time, like the other four VITE_* vars. Flipping it needs a redeploy,
 * which is the right shape for something that changes once at the end of a beta.
 */
export const INVITE_ONLY = import.meta.env.VITE_INVITE_ONLY === "true";

/** Where the landing page and the installed PWA send someone who taps through. */
export const ENTRY_ROUTE = INVITE_ONLY ? "/signin" : "/signup";
