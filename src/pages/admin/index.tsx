import { useEffect, useRef, useState } from "react";
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

    const barRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});

    // Bring the selected tab fully into view. Without this the last tabs are
    // reachable only by scrolling a bar most people never realise scrolls — with
    // six tabs the overflow is about 26px at 390px wide, small enough to read as a
    // clipped label rather than a hint. It also keeps working as tabs are added.
    // scrollLeft rather than scrollIntoView, which would also scroll the page
    // vertically and yank the content out from under the tap.
    useEffect(() => {
        const bar = barRef.current;
        const el = tabRefs.current[tab];
        if (!bar || !el) return;

        const barBox = bar.getBoundingClientRect();
        const elBox = el.getBoundingClientRect();
        // Keep the 20px gutter visible past the tab rather than flush to the edge.
        const GUTTER = 20;
        const pastRight = elBox.right - (barBox.right - GUTTER);
        const pastLeft = barBox.left + GUTTER - elBox.left;

        if (pastRight > 0) bar.scrollBy({ left: pastRight, behavior: "smooth" });
        else if (pastLeft > 0) bar.scrollBy({ left: -pastLeft, behavior: "smooth" });
    }, [tab]);

    return (
        <AppLayout>
            {/* Fills <main> as a flex column so each tab's content can grow into the
                space left under the tab bar — that's what lets a loading spinner
                centre in the list area instead of collapsing to the top. */}
            <div className="flex min-h-full flex-col">
            {/* Tab bar — active tab gets a green underline bar (design 350:5076). */}
            <div className="sticky top-0 z-10 bg-primary">
                {/* Scrolls horizontally once the tabs stop fitting, which at six is
                    already true below ~430px. Full bleed on purpose: px-5 on the
                    scroller keeps the gutter at both scroll extremes while letting the
                    last tab run to the edge in between, which is what signals there is
                    more to reach. scrollbar-hide because the bar would otherwise sit
                    directly under the active tab's underline.

                    touch-pan-x and overflow-y-hidden are what make it scroll on a
                    phone. Setting overflow-x alone leaves overflow-y computing to
                    auto, so the bar is a scroll container on both axes with nothing to
                    scroll vertically; with touch-action left at auto, iOS is free to
                    read a horizontal swipe as belonging to the page's vertical
                    scroller instead — which is why this worked with a mouse and not
                    with a finger. pan-x claims horizontal panning explicitly.
                    Trade-off: a vertical drag that starts on the bar no longer scrolls
                    the page. The bar is a thin strip, so that is the cheaper side.

                    The inner row is w-max so its width is its content, and min-w-full
                    so it still fills — and so justify-between still spreads the tabs —
                    when they do fit. Without w-max the row is capped at the container
                    and adding a seventh tab would squeeze rather than scroll. */}
                <div
                    ref={barRef}
                    className="touch-pan-x overflow-x-auto overflow-y-hidden px-5 scrollbar-hide"
                >
                <div className="flex w-max min-w-full justify-between gap-5">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            ref={(el) => { tabRefs.current[t.key] = el; }}
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
