/**
 * Turns a failed fetch into copy a person can act on.
 *
 * Supabase and the browser surface transport failures as raw strings —
 * "TypeError: Load failed", "Failed to fetch", or a Postgres error code. Those
 * were reaching the screen. Nothing here ever returns the underlying message;
 * callers should log it instead.
 */

// What a dropped connection looks like across browsers and supabase-js.
const CONNECTIVITY_HINTS = [
    /load failed/i, // Safari
    /failed to fetch/i, // Chrome / Firefox
    /networkerror/i,
    /network request failed/i,
    /fetch failed/i,
    /err_internet_disconnected/i,
    /err_network/i,
    /the internet connection appears to be offline/i,
];

function messageOf(error: unknown): string {
    if (!error) return "";
    if (typeof error === "string") return error;
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    if (typeof error === "object") {
        const e = error as { message?: unknown; error_description?: unknown; details?: unknown };
        return [e.message, e.error_description, e.details].filter((v) => typeof v === "string").join(" ");
    }
    return "";
}

/** True when the failure is the device being offline or the request never landing. */
export function isConnectivityError(error: unknown): boolean {
    // navigator.onLine has false positives (captive portals) but no false
    // negatives that matter here: if it says offline, it is.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    const msg = messageOf(error);
    return CONNECTIVITY_HINTS.some((re) => re.test(msg));
}

export interface LoadErrorCopy {
    title: string;
    message: string;
}

/**
 * @param subject what failed to load, as it reads mid-sentence — "the feed",
 * "your activity", "this profile".
 */
export function describeLoadError(error: unknown, subject = "this page"): LoadErrorCopy {
    if (isConnectivityError(error)) {
        return {
            title: "No internet connection",
            message: `CourtPlay can't load ${subject} while you're offline. Reconnect and try again.`,
        };
    }
    return {
        title: "Something went wrong",
        message: `We couldn't load ${subject}. Try again in a moment.`,
    };
}

/**
 * A single line for an action that failed, shown next to the control that
 * triggered it — saving, deleting, suspending.
 *
 * @param action what was attempted, as it reads after "couldn't" —
 * "save those changes", "delete that post".
 */
export function describeActionError(error: unknown, action: string): string {
    if (isConnectivityError(error)) {
        return "No internet connection. Reconnect and try again.";
    }
    return `Couldn't ${action}. Try again.`;
}

// Supabase auth messages are mostly readable, but they are written for
// developers and a few are unusable ("Database error granting user"). Map the
// ones people actually hit; anything unrecognised falls back to generic rather
// than putting an internal string on screen.
const AUTH_MESSAGES: [RegExp, string][] = [
    [/invalid login credentials/i, "That email or password isn't right."],
    [/email not confirmed/i, "Confirm your email address first — check your inbox for the link."],
    [/user already registered|already been registered/i, "An account with this email already exists. Try signing in instead."],
    [/unable to validate email address|invalid format/i, "That doesn't look like a valid email address."],
    [/password should be at least (\d+)/i, "Choose a longer password — at least 8 characters."],
    [/new password should be different/i, "Choose a password you haven't used before."],
    [/for security purposes|rate limit|too many requests/i, "Too many attempts. Wait a moment and try again."],
    [/email link is invalid or has expired|token has expired/i, "That link has expired. Request a new one."],
    [/user not found/i, "We couldn't find an account with that email."],
];

/** Turns a Supabase auth failure into something worth reading. */
export function describeAuthError(error: unknown): string {
    if (isConnectivityError(error)) {
        return "No internet connection. Reconnect and try again.";
    }
    const msg = messageOf(error);
    for (const [pattern, copy] of AUTH_MESSAGES) {
        if (pattern.test(msg)) return copy;
    }
    return "Something went wrong. Try again.";
}
