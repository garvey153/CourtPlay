/**
 * Button surfaces, per the design system (Figma node 32:85 / 32:506).
 *
 * These were declared as local constants in 26 files — 45 declarations of 16
 * distinct values — which is how they drifted. Every value below is preserved
 * exactly as it was at the call site, so adopting this module changed nothing
 * visually; the point is that the variation is now visible in one place instead
 * of scattered, and convergence is a one-line edit here rather than a hunt.
 *
 * Naming: ROLE_SIZE[_FULL][_GAPn][_modifier].
 *   sizes   SM = px-4 py-2 · MD = px-4 py-2.5 · LG = px-5 py-3 · H9 = fixed h-9
 *   FULL    w-full
 *
 * KNOWN DRIFT, still open:
 *
 *   Secondary hover is split two ways. SECONDARY_MD and friends use
 *   `hover:text-primary` (12 call sites, the detail and filter sheets); the
 *   _HOVERFILL variants use `hover:bg-brand-800` (5 call sites: post-new,
 *   onboarding, and the report/feedback sheets). Same button, two behaviours.
 *   Picking one is a design call, so it is left alone here.
 *
 * Sheet buttons also split SM (py-2) vs MD (py-2.5) with no clear rule.
 *
 * Two subset variants were folded away once they were shown to be accidental:
 * claim-detail-sheet's secondary lacked flex centring and disabled: styles
 * (its cancel button is disabled while working and did not dim), and
 * not-found's primary used `hover:` rather than `enabled:hover:`.
 */

/** 12 call sites: components/app/claim-detail-sheet.tsx, components/app/created-detail-sheet.tsx, components/app/group-detail-sheet.tsx, components/app/regular-connections-sheet.tsx, pages/admin/admin-claim-detail-sheet.tsx, pages/admin/admin-claim-filter-sheet.tsx, pages/admin/admin-court-sheet.tsx, pages/admin/admin-post-detail-sheet.tsx, pages/admin/admin-report-detail-sheet.tsx, pages/admin/admin-user-detail-sheet.tsx, pages/admin/admin-user-filter-sheet.tsx, pages/edit-profile.tsx */
export const PRIMARY_MD =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/** 12 call sites: components/app/claim-detail-sheet.tsx, components/app/created-detail-sheet.tsx, components/app/group-detail-sheet.tsx, components/app/regular-connections-sheet.tsx, pages/admin/admin-claim-detail-sheet.tsx, pages/admin/admin-claim-filter-sheet.tsx, pages/admin/admin-court-sheet.tsx, pages/admin/admin-post-detail-sheet.tsx, pages/admin/admin-report-detail-sheet.tsx, pages/admin/admin-user-detail-sheet.tsx, pages/admin/admin-user-filter-sheet.tsx, pages/edit-profile.tsx */
export const SECONDARY_MD =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

/** 3 call sites: pages/auth.tsx, pages/forgot-password.tsx, pages/reset-password.tsx */
export const PRIMARY_H9_FULL =
    "flex h-9 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/** 3 call sites: components/app/feedback-sheet.tsx, components/app/report-modal.tsx, components/app/report-user-sheet.tsx */
export const PRIMARY_SM_FULL =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/** 3 call sites: components/app/feedback-sheet.tsx, components/app/report-modal.tsx, components/app/report-user-sheet.tsx */
export const SECONDARY_SM_FULL_HOVERFILL =
    "flex w-full items-center justify-center rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50";

/** 1 call site: pages/admin/admin-feedback-detail-sheet.tsx */
export const DANGER_MD_FULL_GAP1_5 =
    "flex w-full items-center justify-center gap-1.5 rounded-lg bg-error-solid px-4 py-2.5 text-sm font-semibold text-white transition duration-100 ease-linear enabled:hover:bg-error-solid_hover disabled:cursor-not-allowed disabled:opacity-50";

/** 1 call site: pages/auth.tsx */
export const GOOGLE_FULL =
    "w-full !bg-white !text-gray-700 !ring-1 !ring-black/10 hover:!bg-gray-50";

/** 1 call site: pages/landing.tsx */
export const PRIMARY_LG_GAP1 =
    "flex items-center justify-center gap-1 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600";

/** 2 call sites: pages/admin/admin-feedback-detail-sheet.tsx, pages/not-found.tsx */
export const PRIMARY_MD_FULL =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/** 1 call site: pages/post-new.tsx */
export const PRIMARY_SM =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/** 1 call site: pages/onboarding.tsx */
export const PRIMARY_SM_GAP1_5 =
    "flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/** 1 call site: components/app/install-app-button.tsx */
export const SECONDARY_LG_GAP1 =
    "inline-flex items-center justify-center gap-1 rounded-lg bg-tertiary px-5 py-3 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

/** 1 call site: pages/admin/admin-feedback-detail-sheet.tsx */
export const SECONDARY_MD_FULL =
    "flex w-full items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

/** 1 call site: pages/not-found.tsx */
export const SECONDARY_MD_FULL_GAP2 =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

/** 1 call site: pages/onboarding.tsx */
export const SECONDARY_SM_GAP1_HOVERFILL =
    "flex items-center justify-center gap-1 rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800";

/** 1 call site: pages/post-new.tsx */
export const SECONDARY_SM_HOVERFILL =
    "rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800";
