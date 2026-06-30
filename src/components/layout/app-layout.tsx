import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { IosInstallPrompt } from "@/components/app/ios-install-prompt";
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
        <div className="flex min-h-dvh flex-col bg-primary">
            <TopNav onOpenFilters={onOpenFilters} filtersActive={filtersActive} />
            <IosInstallPrompt />
            <main className="flex-1 pb-20">{children}</main>
            <BottomNav />
        </div>
    );
}
