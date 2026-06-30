import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { IosInstallPrompt } from "@/components/app/ios-install-prompt";
import { TopNav } from "./top-nav";

export function AppLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col bg-primary">
            <TopNav />
            <IosInstallPrompt />
            <main className="flex-1 pb-20">{children}</main>
            <BottomNav />
        </div>
    );
}
