import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
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
    return (
        // Fixed-height app shell: the header and bottom nav stay put while only
        // <main> scrolls. overscroll-contain stops the browser's native pull-to-
        // refresh so the feed can own that gesture.
        <div className="flex h-dvh flex-col overflow-hidden bg-primary">
            <TopNav onOpenFilters={onOpenFilters} filtersActive={filtersActive} />
            {/* The fixed BottomNav sits outside the flow, so content needs bottom
                padding to clear it. A custom footer is in-flow, so it doesn't.
                - min-h-0 lets this flex child shrink so its own content scrolls.
                - relative makes this the containing block for descendants' absolute
                  positioning. react-aria form controls (toggles, checkboxes) render
                  a position:absolute visually-hidden input; without a positioned
                  ancestor it anchors to the viewport, extending the document's
                  scroll height — which lets the page (and the footer) scroll and,
                  on focus, jump the whole shell out of view. Containing it here
                  keeps all scrolling inside <main>. */}
            <main className={cx("relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain", footer ? "" : "pb-20")}>
                {children}
            </main>
            {footer ?? <BottomNav />}
        </div>
    );
}
