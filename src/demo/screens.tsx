import { Feed } from "@/pages/feed";
import { Activity } from "@/pages/activity";
import { Profile } from "@/pages/profile";
import { PostNew } from "@/pages/post-new";
import { AppLayout } from "@/components/layout/app-layout";
import { SubCard } from "@/components/app/sub-card";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { CreatedDetailSheet } from "@/components/app/created-detail-sheet";
import { DEMO_BACKDROP_POST, DEMO_MY_POST, DEMO_POSTER, DEMO_CLAIMED_POST, DEMO_SUB_POST, DEMO_VIEWER_ID } from "./fixtures";

/**
 * The screens behind the tutorial screenshots.
 *
 * These render the REAL pages wherever the design shows a whole screen. An
 * earlier version composed each screen from its parts, and the result was
 * always structurally thinner than the page it imitated — the post form lost
 * every field below the type picker, Activity lost its tabs, the profile lost
 * its header. That is what "missing elements" meant.
 *
 * Rendering the pages is possible because DEMO=1 aliases @/lib/supabase to a
 * fixture client (src/demo/supabase-mock.ts), so nothing reaches the network.
 * The jsdom fingerprint test mocks the same path to the same module, so both
 * engines render the same tree.
 *
 * The two SHEETS stay compositions, because a sheet genuinely is a component
 * rendered over a page — that is how the app itself does it.
 */
const noop = () => {};

/**
 * The feed behind a sheet: in the app every sheet opens over it.
 *
 * Sub cards only, inset, and neutral.
 *
 * An accent bar is a 4px vertical line repeated down the stack, so the blur
 * turns it into one continuous coloured streak up the left side — blue behind a
 * regular-play card, green behind a sub. Measuring the design's own asset shows
 * the same streak, so this is a deliberate departure from it rather than a
 * defect being corrected.
 *
 * "claimed" is the neutral kind: grey bar, grey badge. The cards are unreadable
 * at this blur anyway; their job back here is texture, and texture should not
 * have a colour of its own.
 */
const FeedBehind = () => (
    <AppLayout onOpenFilters={noop}>
        <div className="flex flex-col gap-3 px-5">
            <SubCard post={DEMO_SUB_POST} currentUserId={DEMO_VIEWER_ID} kindOverride="claimed" />
            <SubCard post={DEMO_BACKDROP_POST} currentUserId={DEMO_VIEWER_ID} kindOverride="claimed" />
            <SubCard post={DEMO_CLAIMED_POST} currentUserId={DEMO_VIEWER_ID} kindOverride="claimed" />
        </div>
    </AppLayout>
);

export const DEMO_SCREENS: Record<string, () => React.ReactElement> = {
    feed: () => <Feed />,

    claim: () => (
        <>
            <FeedBehind />
            <ClaimDetailSheet post={DEMO_SUB_POST} currentUserId={DEMO_VIEWER_ID} onClose={noop} />
        </>
    ),

    approve: () => (
        <>
            <FeedBehind />
            <CreatedDetailSheet
                post={DEMO_MY_POST}
                poster={DEMO_POSTER}
                onClose={noop}
                onApprove={noop}
                onDecline={noop}
                onEdit={noop}
                onDelete={noop}
                // The reply field only renders when the sheet is given somewhere
                // to send to, and the design shows it.
                onReply={noop}
            />
        </>
    ),

    post: () => <PostNew />,

    activity: () => <Activity />,

    groups: () => <Profile />,
};

/**
 * Where a screen believes it is. Activity opens on the tab named in ?tab=, and
 * the design shows Created posts.
 *
 * Set on the router DemoProviders creates, rather than by nesting one — react
 * router forbids a Router inside a Router.
 */
export const SCREEN_ROUTES: Record<string, string> = {
    activity: "/activity?tab=created",
};

export type DemoScreenId = keyof typeof DEMO_SCREENS;
