/**
 * The post-onboarding tutorial.
 *
 * Each slide's image is captured from a demo screen in src/demo/screens.tsx by
 * `npm run capture:tutorial`, using fake accounts — no real player's name or
 * photo may appear here. A vitest fingerprint test fails when a screen's
 * structure changes, so a UI change tells you the images need re-taking.
 *
 * Copy uses the app's own vocabulary: a "spot" is what you claim, "Connect" is
 * what you do on a regular-game post, and the two post types are "Find a sub"
 * and "Find a regular game".
 */
export interface TutorialSlide {
    /** Matches the demo screen id, so image and screen cannot drift apart. */
    id: string;
    image: string;
    alt: string;
    headline: string;
    body: string;
}

export const TUTORIAL_SLIDES: TutorialSlide[] = [
    {
        id: "feed",
        image: "/tutorial/01-feed.jpg",
        alt: "The CourtPlay feed showing an open doubles spot and a regular game post.",
        headline: "Your tennis feed",
        body: "Open spots and regular games, soonest first. Posts from your groups and the players you follow rise to the top. Tap Post to add your own.",
    },
    {
        id: "claim",
        image: "/tutorial/02-claim.jpg",
        alt: "A post's detail sheet with a Claim for $25 button.",
        headline: "Claim a spot",
        body: "Tap a post to see the court, time and cost, then claim the spot. You can claim any game at your level or above.",
    },
    {
        id: "approve",
        image: "/tutorial/03-approve.jpg",
        alt: "A claim on your own post, with Approve claim and Decline buttons.",
        headline: "You decide who plays",
        body: "Claims on your posts come to you. Approve or decline — your phone and Venmo stay hidden until you approve.",
    },
    {
        id: "connect",
        image: "/tutorial/04-connect.jpg",
        alt: "A regular game post with a Connect button.",
        headline: "Find a regular game",
        body: "Looking for something ongoing rather than a one-off? Tap Connect to start a conversation with the poster. No approval needed.",
    },
    {
        id: "activity",
        image: "/tutorial/05-activity.jpg",
        alt: "The Activity screen showing pending and approved claims.",
        headline: "Track it in Activity",
        body: "Answered posts holds the spots you claimed. Created posts holds what you posted. Replay this tutorial any time from Manage.",
    },
];
