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
