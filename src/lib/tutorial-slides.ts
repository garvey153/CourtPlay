/**
 * The post-onboarding tutorial (Figma 662:9864 and the five frames after it).
 *
 * Each slide's image is captured from a demo screen in src/demo/screens.tsx by
 * `npm run capture:tutorial`, using fake accounts — no real player's name or
 * photo may appear here. A vitest fingerprint test renders those same screens
 * and fails when their structure changes, so a UI change tells you the images
 * need re-taking.
 *
 * Copy is the design's, verbatim.

 *
 * Order here is the display order, and DEMO_SCREENS is kept in the same order
 * so the numbers in the filenames agree with it.
 */
export interface TutorialSlide {
    /** Matches the demo screen id, so image and screen cannot drift apart. */
    id: string;
    image: string;
    alt: string;
    headline: string;
    body: string;
    /**
     * Which end of the screenshot matters, which decides how it is cropped and
     * which edge fades out.
     *
     * The design pulls sheet screens up by ~100px so the buttons at the bottom
     * of the phone are what you see, and fades the top instead of the bottom.
     * Full screens sit at the top and fade at the bottom.
     */
    focus: "top" | "bottom";
}

export const TUTORIAL_SLIDES: TutorialSlide[] = [
    {
        id: "feed",
        image: "/tutorial/01-feed.jpg",
        alt: "The CourtPlay feed, showing open spots and a regular game post.",
        headline: "Your tennis feed.",
        body: "Open spots and people looking for regular play are listed, soonest first. Posts from friends you follow or your groups rise to the top.",
        focus: "top",
    },
    {
        id: "claim",
        image: "/tutorial/02-claim.jpg",
        alt: "A post's detail sheet with a Claim for $25 button.",
        headline: "Claim a spot.",
        body: "Tap a post to see the time and cost, then claim the spot. You can claim any game at your level or above.",
        focus: "bottom",
    },
    {
        id: "post",
        image: "/tutorial/03-post.jpg",
        alt: "The new post form, choosing between Find a sub and Find a regular game.",
        headline: "Post in a few taps.",
        body: "Find a sub or share your availability to join a regular clinic or game play. Either can be private, so only chosen groups or players can claim.",
        focus: "top",
    },
    {
        id: "approve",
        image: "/tutorial/04-approve.jpg",
        alt: "A claim on your own post, with Approve claim and Decline buttons.",
        headline: "You decide who plays.",
        body: "Claims on your posts come to you. Approve or Decline, your contact info and Venmo stay hidden until you approve.",
        focus: "bottom",
    },
    {
        id: "activity",
        image: "/tutorial/05-activity.jpg",
        alt: "The Activity screen, showing claimed and created posts.",
        headline: "Keep track in Activity.",
        body: "Answered posts holds the spots you claimed. Created posts hold what you posted. Message in app so the details are never lost.",
        focus: "top",
    },
    {
        id: "groups",
        image: "/tutorial/06-groups.jpg",
        alt: "A profile showing your groups and their members.",
        headline: "Your groups.",
        body: "Make a group for the people you play with. Share spots with only them or tag a group when posting an opening to keep them in the loop.",
        focus: "top",
    },
];
