import { useState } from "react";
import { cx } from "@/utils/cx";
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
            {/* Tab bar — active tab gets a green underline bar (design 350:5076). */}
            <div className="sticky top-0 z-10 bg-primary">
                <div className="flex justify-between gap-5 overflow-x-auto px-5">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className="flex shrink-0 flex-col gap-2 pt-2"
                        >
                            <span className={cx("whitespace-nowrap text-sm", tab === t.key ? "text-primary" : "text-secondary")}>
                                {t.label}
                            </span>
                            <span className={cx("h-1 w-full rounded-full", tab === t.key ? "bg-brand-500" : "bg-transparent")} />
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-5 py-4">
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
