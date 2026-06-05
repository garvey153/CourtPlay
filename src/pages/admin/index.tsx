import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AdminPosts } from "./admin-posts";
import { AdminUsers } from "./admin-users";
import { AdminClaims } from "./admin-claims";
import { AdminCourts } from "./admin-courts";
import { AdminReports } from "./admin-reports";
import { AdminAnalytics } from "./admin-analytics";

const TABS = [
    { key: "analytics", label: "Analytics" },
    { key: "posts", label: "Posts" },
    { key: "users", label: "Users" },
    { key: "claims", label: "Claims" },
    { key: "courts", label: "Courts" },
    { key: "reports", label: "Reports" },
] as const;

type AdminTab = (typeof TABS)[number]["key"];

export function Admin() {
    const [tab, setTab] = useState<AdminTab>("analytics");

    return (
        <AppLayout>
            {/* Tab bar */}
            <div className="sticky top-0 z-10 border-b border-secondary bg-primary">
                <div className="flex gap-0 overflow-x-auto px-2">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`shrink-0 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${
                                tab === t.key
                                    ? "border-b-2 border-brand text-brand-secondary"
                                    : "text-tertiary"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 py-4">
                {tab === "analytics" && <AdminAnalytics />}
                {tab === "posts" && <AdminPosts />}
                {tab === "users" && <AdminUsers />}
                {tab === "claims" && <AdminClaims />}
                {tab === "courts" && <AdminCourts />}
                {tab === "reports" && <AdminReports />}
            </div>
        </AppLayout>
    );
}
