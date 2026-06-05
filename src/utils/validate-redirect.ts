const SAFE_REDIRECT_RE = /^\/post\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates a redirect path from query params.
 * Only allows /post/:uuid paths to prevent open redirects.
 * Returns the path if valid, null otherwise.
 */
export function validateRedirect(redirect: string | null): string | null {
    if (!redirect) return null;
    if (SAFE_REDIRECT_RE.test(redirect)) return redirect;
    return null;
}
