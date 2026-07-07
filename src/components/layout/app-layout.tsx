import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { TopNav } from "./top-nav";

interface AppLayoutProps {
    children: ReactNode;
    /** When provided (feed only), the header shows a filter icon wired to this handler. */
    onOpenFilters?: () => void;
    /** Shows an active dot on the header filter icon when any filter is applied. */
    filtersActive?: boolean;
}

export function AppLayout({ children, onOpenFilters, filtersActive }: AppLayoutProps) {
    return (
        // Fixed-height app shell: the header and bottom nav stay put while only
        // <main> scrolls. overscroll-contain stops the browser's native pull-to-
        // refresh so the feed can own that gesture.
        <div className="flex h-dvh flex-col overflow-hidden bg-primary">
            <TopNav onOpenFilters={onOpenFilters} filtersActive={filtersActive} />
            <main className="flex-1 overflow-y-auto overscroll-y-contain pb-20">{children}</main>
            <BottomNav />
        </div>
    );
}
