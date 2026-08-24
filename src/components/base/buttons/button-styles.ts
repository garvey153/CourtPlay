/**
 * Button surfaces, per the design system (Figma node 32:85 / 32:506).
 *
 * These were declared as local constants in 26 files — 45 declarations of 16
 * distinct values — which is how they drifted. Collecting them here made the
 * variation visible in one place, which is what let the accidental parts be
 * separated from the deliberate ones and folded away.
 *
 * Naming: ROLE_SIZE[_FULL][_GAPn].
 *   sizes   SM = px-4 py-2 · MD = px-4 py-2.5 · LG = px-5 py-3 · H9 = fixed h-9
 *   FULL    w-full
 *
 * **Every secondary button hovers to `hover:text-primary`.** It used to be split
 * two ways — the detail and filter sheets brightened the text, while post-new,
 * onboarding and the report/feedback sheets filled the background with a brand
 * tint instead. Same button, two behaviours, decided in favour of the text
 * change. Keep it that way: a new fill-on-hover secondary is drift, not a
 * variant.
 *
 * (That tint is deliberately described rather than named. Tailwind scans this
 * file for class-like tokens and cannot tell a comment from code, so spelling
 * the old class out here emitted a CSS rule nothing used.)
 *
 * Three accidental variants have been folded away: the two hover-fill spellings
 * above; claim-detail-sheet's secondary, which lacked flex centring and the
 * disabled: styles (its cancel button is disabled while working and did not
 * dim); and not-found's primary, which used `hover:` rather than
 * `enabled:hover:`.
 *
 * Still unresolved: sheet buttons split SM (py-2) vs MD (py-2.5) with no clear
 * rule, and cta.ts holds a third pair (PRIMARY_CTA / SECONDARY_CTA) used by the
 * shared empty and error states.
 *
 * ON `has-[[data-spinner]]:opacity-100`: a button that is working is disabled,
 * so `disabled:opacity-50` dims it — including the spinner, which then reads as
 * a faded circle sitting in a tinted box. The box is Safari drawing the
 * spinner's own compositing layer, which it gets for animating a transform,
 * against a parent carrying group opacity. Reported on the admin deactivate
 * confirmation.
 *
 * So a button holding a spinner stays at full opacity. Better regardless: the
 * spinner is what says "working", and a half-faded control says "unavailable"
 * over the top of it.
 */

/** 12 call sites: components/app/claim-detail-sheet.tsx, components/app/created-detail-sheet.tsx, components/app/regular-play-sheet.tsx, components/app/regular-connections-sheet.tsx, pages/admin/admin-claim-detail-sheet.tsx, pages/admin/admin-claim-filter-sheet.tsx, pages/admin/admin-court-sheet.tsx, pages/admin/admin-post-detail-sheet.tsx, pages/admin/admin-report-detail-sheet.tsx, pages/admin/admin-user-detail-sheet.tsx, pages/admin/admin-user-filter-sheet.tsx, pages/edit-profile.tsx */
export const PRIMARY_MD =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 12 call sites: components/app/claim-detail-sheet.tsx, components/app/created-detail-sheet.tsx, components/app/regular-play-sheet.tsx, components/app/regular-connections-sheet.tsx, pages/admin/admin-claim-detail-sheet.tsx, pages/admin/admin-claim-filter-sheet.tsx, pages/admin/admin-court-sheet.tsx, pages/admin/admin-post-detail-sheet.tsx, pages/admin/admin-report-detail-sheet.tsx, pages/admin/admin-user-detail-sheet.tsx, pages/admin/admin-user-filter-sheet.tsx, pages/edit-profile.tsx */
export const SECONDARY_MD =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 3 call sites: pages/auth.tsx, pages/forgot-password.tsx, pages/reset-password.tsx */
export const PRIMARY_H9_FULL =
    "flex h-9 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 3 call sites: components/app/feedback-sheet.tsx, components/app/report-modal.tsx, components/app/report-user-sheet.tsx */
export const PRIMARY_SM_FULL =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 3 call sites: components/app/feedback-sheet.tsx, components/app/report-modal.tsx, components/app/report-user-sheet.tsx */
export const SECONDARY_SM_FULL =
    "flex w-full items-center justify-center rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 1 call site: pages/admin/admin-feedback-detail-sheet.tsx */
export const DANGER_MD_FULL_GAP1_5 =
    "flex w-full items-center justify-center gap-1.5 rounded-lg bg-error-solid px-4 py-2.5 text-sm font-semibold text-white transition duration-100 ease-linear enabled:hover:bg-error-solid_hover disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 1 call site: pages/auth.tsx */
export const GOOGLE_FULL =
    "w-full !bg-white !text-gray-700 !ring-1 !ring-black/10 hover:!bg-gray-50";

/** 1 call site: pages/landing.tsx */
export const PRIMARY_LG_GAP1 =
    "flex items-center justify-center gap-1 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600";

/** 2 call sites: pages/admin/admin-feedback-detail-sheet.tsx, pages/not-found.tsx */
export const PRIMARY_MD_FULL =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 1 call site: pages/post-new.tsx */
export const PRIMARY_SM =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 1 call site: pages/onboarding.tsx */
export const PRIMARY_SM_GAP1_5 =
    "flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 1 call site: components/app/install-app-button.tsx */
export const SECONDARY_LG_GAP1 =
    "inline-flex items-center justify-center gap-1 rounded-lg bg-tertiary px-5 py-3 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

/** 1 call site: pages/admin/admin-feedback-detail-sheet.tsx */
export const SECONDARY_MD_FULL =
    "flex w-full items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100";

/** 1 call site: pages/not-found.tsx */
export const SECONDARY_MD_FULL_GAP2 =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

/** 1 call site: pages/onboarding.tsx */
export const SECONDARY_SM_GAP1 =
    "flex items-center justify-center gap-1 rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

/** 1 call site: pages/post-new.tsx */
export const SECONDARY_SM =
    "rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";
