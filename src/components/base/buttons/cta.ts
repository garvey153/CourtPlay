/**
 * The primary call to action, straight from the design system —
 * Figma node 32:506 (CourtPlay Design System → Button / Primary / S).
 *
 *   bg      bg/brand      #1AB363  → brand-500
 *   text    text/on-brand #08180E  → neutral-950
 *   radius  radius/sm     8        → rounded-lg
 *   padding 16 / 8                 → px-4 py-2
 *   type    Text sm/Semibold       → text-sm font-semibold
 *
 * Note this is NOT the Untitled UI `Button` with `color="primary"`, which is
 * bg-brand-solid (brand-600) with white text and does not match the design
 * system. Nor is it `text-primary_on-brand`, which resolves to white here.
 *
 * The same string is currently inlined as a local PRIMARY_BTN in ~23 files;
 * this is the one definition new code should import.
 */
export const PRIMARY_CTA =
    "inline-flex items-center justify-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The quieter counterpart. Nothing uses it since the Activity empty states moved
 * onto PRIMARY_CTA to match Feed and Profile — kept as the EmptyState component's
 * `actionTone="secondary"` option rather than deleted.
 */
export const SECONDARY_CTA =
    "inline-flex items-center justify-center gap-1 rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";
