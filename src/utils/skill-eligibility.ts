/**
 * Who may claim a sub spot, by NTRP rating.
 *
 * A player may claim a game at their own level or ABOVE it. Anyone rated below
 * the game's level is out of range — including by a single 0.5 step, so a 3.5
 * cannot claim a 4.0 game.
 *
 * Playing up is never restricted. Someone rated below the game is the case the
 * poster is protected from; someone rated above it is a bonus, not a problem.
 *
 * Unknown ratings do not block. A missing level on either side means the rule
 * cannot be evaluated, and locking someone out of every game over absent data
 * is worse than letting the poster decline the claim.
 */

const parse = (level: string | null | undefined): number | null => {
    if (!level) return null;
    const n = Number.parseFloat(level);
    return Number.isFinite(n) ? n : null;
};

/** True when the viewer is rated below the post's level and so cannot claim it. */
export function isBelowRequiredLevel(viewerLevel: string | null | undefined, postLevel: string | null | undefined): boolean {
    const viewer = parse(viewerLevel);
    const post = parse(postLevel);
    if (viewer === null || post === null) return false;
    return viewer < post;
}
