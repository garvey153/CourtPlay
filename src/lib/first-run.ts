/**
 * The per-player state the feed's one-time prompts keep in web storage.
 *
 * All of it is per DEVICE, not per account. A second player on a phone — or the
 * same person whose account was deleted and re-created, which is how this
 * surfaced — inherits the previous player's dismissals and never sees the
 * welcome card or the install prompt. Onboarding clears the lot on finish,
 * because that is the moment a player is new.
 *
 * Adding a prompt with its own key means adding it here; a test compares this
 * list against the keys those components actually name, so forgetting fails
 * rather than quietly leaving the new prompt un-resettable.
 */
export const FIRST_RUN_KEYS = [
    "courtsub_post_created",
    "courtsub_push_prompt_dismissed",
    "cs_claim_banner_dismissed",
    "cs_feedback_banner_dismissed",
    "cs_ios_prompt_dismissed",
    "cs_welcome_active",
    "cs_welcome_dismissed",
    "cs_welcome_done",
    "cs_welcome_started",
];
