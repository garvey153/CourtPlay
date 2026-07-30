/**
 * True on iPhone/iPad/iPod. Used to decide which manual "Add to Home Screen"
 * steps to show, since iOS Safari has no programmatic install API.
 */
export function isIos(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
