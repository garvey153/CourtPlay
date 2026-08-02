/**
 * Covers the app when a phone is turned sideways.
 *
 * Rendered once at the root so it applies to every route, including the ones
 * outside AppLayout (landing, auth, terms). Visibility is driven entirely by the
 * media query on [data-landscape-guard] in globals.css — no JS, no resize
 * listener, no state, so it can't flash on rotate or disagree with the layout.
 *
 * It cannot actually prevent rotation on iOS; nothing web-facing can. It covers
 * the rotated layout instead. See the note in globals.css.
 */
export function LandscapeGuard() {
    return (
        <div
            data-landscape-guard
            // `fixed inset-0` and a z-index above the sheets (z-50) so it also
            // covers an open Create Post or detail sheet, not just the page.
            className="fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-primary px-8 text-center"
            role="alertdialog"
            aria-label="Rotate your device"
        >
            <img src="/courtplay-logo.svg" alt="" aria-hidden="true" className="h-8 w-auto opacity-90" />
            <p className="text-lg font-semibold text-primary">Wrong side of the net</p>
            <p className="max-w-xs text-sm text-tertiary">
                CourtPlay plays in portrait. Turn your phone upright to get back on court.
            </p>
        </div>
    );
}
