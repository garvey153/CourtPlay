import { AppLayout } from "@/components/layout/app-layout";
import { SubCard } from "@/components/app/sub-card";
import { RegularPlayCard } from "@/components/app/regular-play-card";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";
import { CreatedDetailSheet } from "@/components/app/created-detail-sheet";
import { RegularPlaySheet } from "@/components/app/regular-play-sheet";
import {
    DEMO_CLAIMED_POST,
    DEMO_MY_POST,
    DEMO_POSTER,
    DEMO_PROFILE,
    DEMO_REGULAR_POST,
    DEMO_SUB_POST,
    DEMO_VIEWER_ID,
} from "./fixtures";

/**
 * The screens behind the tutorial screenshots.
 *
 * These are thin compositions of the app's REAL components against fixture
 * props — not the page containers. Feed and Activity fetch on mount, subscribe
 * to realtime and read session heuristics from localStorage; rendering those
 * would make the output depend on fetch timing rather than on the UI, in two
 * different engines. Every sheet shown here renders purely from props (they
 * import supabase but only call it inside handlers), which is what makes this
 * viable at all.
 *
 * KEEP EACH ONE THIN. The fingerprint test tracks these screens, not the pages,
 * so the further they drift from how the real page composes things the less the
 * staleness check is worth. A dozen lines each is the budget.
 */
const noop = () => {};

/**
 * The feed, as the backdrop behind a sheet. In the app every sheet opens over
 * it — screenshotting one against an empty page would show a state that never
 * actually occurs.
 */
const FeedBehind = () => (
    <AppLayout onOpenFilters={noop}>
        <div className="flex flex-col gap-3">
            <SubCard post={DEMO_SUB_POST} currentUserId={DEMO_VIEWER_ID} />
            <RegularPlayCard post={DEMO_REGULAR_POST} profileComplete currentUserId={DEMO_VIEWER_ID} />
        </div>
    </AppLayout>
);

/** Registry key → what the capture script and the fingerprint test both render. */
export const DEMO_SCREENS: Record<string, () => React.ReactElement> = {
    feed: () => (
        <AppLayout onOpenFilters={noop}>
            <div className="flex flex-col gap-3">
                <SubCard post={DEMO_SUB_POST} currentUserId={DEMO_VIEWER_ID} />
                <RegularPlayCard post={DEMO_REGULAR_POST} profileComplete currentUserId={DEMO_VIEWER_ID} />
                <SubCard post={DEMO_CLAIMED_POST} currentUserId={DEMO_VIEWER_ID} />
            </div>
        </AppLayout>
    ),

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
        />
        </>
    ),

    connect: () => (
        <>
            <FeedBehind />
            <RegularPlaySheet
            post={DEMO_REGULAR_POST}
            currentUserId={DEMO_VIEWER_ID}
            onClose={noop}
            currentUser={{
                first_name: DEMO_PROFILE.first_name,
                last_name: DEMO_PROFILE.last_name,
                photo_url: DEMO_PROFILE.photo_url,
                }}
            />
        </>
    ),
    activity: () => (
        <AppLayout>
            <div className="flex flex-col gap-5">
                <div>
                    <p className="mb-2 text-xs font-medium text-tertiary">Pending</p>
                    <SubCard post={DEMO_SUB_POST} currentUserId={DEMO_VIEWER_ID} kindOverride="pending" />
                </div>
                <div>
                    <p className="mb-2 text-xs font-medium text-tertiary">Approved</p>
                    <SubCard
                        post={DEMO_CLAIMED_POST}
                        currentUserId={DEMO_VIEWER_ID}
                        kindOverride="claimed"
                        labelOverride="Approved"
                    />
                </div>
            </div>
        </AppLayout>
    ),

};

export type DemoScreenId = keyof typeof DEMO_SCREENS;
