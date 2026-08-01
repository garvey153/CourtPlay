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
                {/* Inline-block, not flex — and that is load-bearing.
                    A flex row inside this scroller cannot be panned with a finger on
                    iOS: the bar scrolled with a mouse and stayed completely fixed on
                    touch. Tested on-device across five variants; removing `sticky` and
                    removing `touch-action` both still failed, and only the inline-block
                    version scrolled. So the tabs are inline-block in a whitespace-nowrap
                    container, which is the shape that works.

                    Flex comes back only at 480px and up, where all six tabs already
                    fit (they need 416px) and the bar therefore never needs to scroll.
                    A flex row that cannot overflow cannot hit the touch bug, so this
                    restores the spread-to-fill look on desktop while leaving every
                    phone width on the inline-block path that actually works. The
                    breakpoint is deliberately above the 416px fit point rather than at
                    it, so a font or label change cannot quietly put a scrolling bar
                    back into flex.

                    px-5 gives the geometry asked for: Analytics starts on the content
                    gutter, Reports bleeds past the right edge, and scrolling to the end
                    lands Reports exactly on the content's right edge. */}
                <div
                    ref={barRef}
                    className="overflow-x-auto whitespace-nowrap px-5 scrollbar-hide min-[480px]:flex min-[480px]:justify-between min-[480px]:gap-5"
                >
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            ref={(el) => { tabRefs.current[t.key] = el; }}
                            onClick={() => setTab(t.key)}
                            className="ml-5 inline-block pt-2 align-top first:ml-0 min-[480px]:ml-0"
                        >
                            <span className={cx("block text-sm", tab === t.key ? "text-primary" : "text-secondary")}>
                                {t.label}
                            </span>
                            <span className={cx("mt-2 block h-1 rounded-full", tab === t.key ? "bg-brand-500" : "bg-transparent")} />
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
