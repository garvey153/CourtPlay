import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/application/loading-indicator/area-state";

/**
 * Groups — the tab exists (Figma 178:1737) but the feature behind it does not yet.
 *
 * Nothing in the database backs this today: no groups or group_members table, and
 * no audience column on posts. Rather than hide the tab until then, this says so
 * plainly and points back at the feed.
 *
 * `variant="fill"` rather than a flex-1 child: AppLayout's <main> is a flex item
 * with a definite height but is not itself a flex column, so flex-1 resolves to
 * nothing and the state collapses to the top instead of centring.
 */
export function Groups() {
    return (
        <AppLayout>
            <EmptyState
                variant="fill"
                title="Groups are still warming up"
                description="Soon you'll start a group, invite your regulars, and post spots just to them."
                actionLabel="Browse the feed"
                href="/feed"
                actionTone="secondary"
            />
        </AppLayout>
    );
}
