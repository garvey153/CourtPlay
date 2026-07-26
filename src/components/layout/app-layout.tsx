import { type ReactNode, useEffect } from "react";
import { scheduleSettle } from "@/lib/settle-viewport";
import { ViewportDebug } from "@/components/app/viewport-debug";
import { BottomNav } from "./bottom-nav";
import { TopNav } from "./top-nav";

interface AppLayoutProps {
    children: ReactNode;
    /** When provided (feed only), the header shows a filter icon wired to this handler. */
    onOpenFilters?: () => void;
    /** Shows an active dot on the header filter icon when any filter is applied. */
    filtersActive?: boolean;
    /** Replaces the bottom nav with a custom footer (e.g. the Edit profile action bar). */
    footer?: ReactNode;
}

export function AppLayout({ children, onOpenFilters, filtersActive, footer }: AppLayoutProps) {
    // Re-settle the iOS viewport whenever the app shell mounts. The one-time pass in
    // main.tsx runs at document load, which misses entering the shell via client-side
    // navigation — e.g. logging in on the sign-in page then routing to /feed, where
    // the bottom nav would otherwise sit ~40px high until a swipe.
    useEffect(() => {
        scheduleSettle();
    }, []);

    return (
        // Fixed-height app shell: the header and bottom nav stay put while only
        // <main> scrolls. overscroll-contain stops the browser's native pull-to-
        // refresh so the feed can own that gesture.
        <div data-app-shell className="flex h-dvh flex-col overflow-hidden bg-primary">
            {typeof localStorage !== "undefined" && localStorage.getItem("cs_vp_debug") === "1" && <ViewportDebug />}
            <TopNav onOpenFilters={onOpenFilters} filtersActive={filtersActive} />
            {/* The bottom nav and any custom footer are both in-flow flex children, so
                they occupy real space and content needs no padding to clear them.
                - min-h-0 lets this flex child shrink so its own content scrolls.
                - relative makes this the containing block for descendants' absolute
                  positioning. react-aria form controls (toggles, checkboxes) render
                  a position:absolute visually-hidden input; without a positioned
                  ancestor it anchors to the viewport, extending the document's
                  scroll height — which lets the page (and the footer) scroll and,
                  on focus, jump the whole shell out of view. Containing it here
                  keeps all scrolling inside <main>. */}
            <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                {children}
            </main>
            {footer ?? <BottomNav />}
        </div>
    );
}
