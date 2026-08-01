import { useState } from "react";
import { useSearchParams } from "react-router";
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
    // Deep-link support: /admin?tab=reports (e.g. the feed's "View feedback" banner).
    const [searchParams] = useSearchParams();
    const initialTab = TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "analytics";
    const [tab, setTab] = useState<AdminTab>(initialTab);

    return (
        <AppLayout>
            {/* Fills <main> as a flex column so each tab's content can grow into the
                space left under the tab bar — that's what lets a loading spinner
                centre in the list area instead of collapsing to the top. */}
            <div className="flex min-h-full flex-col">
            {/* Tab bar — active tab gets a green underline bar (design 350:5076). */}
            <div className="sticky top-0 z-10 bg-primary">
                {/* Full bleed on purpose: below ~430px the six tabs don't fit, and
                    letting the last one run to the screen edge is what signals there
                    is more to scroll to. px-5 rather than mx-5 so the gutter still
                    appears at both scroll extremes — the bar starts and ends inset,
                    and only bleeds mid-scroll.

                    scrollbar-hide because the scrollbar would sit directly under the
                    active tab's underline. It is declared in globals.css but was used
                    nowhere, so Tailwind had never emitted the rule. */}
                <div className="flex justify-between gap-5 overflow-x-auto px-5 scrollbar-hide">
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

            <div className="flex flex-1 flex-col px-5 py-4">
                {tab === "analytics" && <AdminAnalytics />}
                {tab === "posts" && <AdminPosts />}
                {tab === "users" && <AdminUsers />}
                {tab === "claims" && <AdminClaims />}
                {tab === "courts" && <AdminCourts />}
                {tab === "reports" && <AdminReports />}
            </div>
            </div>
        </AppLayout>
    );
}
