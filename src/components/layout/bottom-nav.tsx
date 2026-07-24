import { Link, useLocation } from "react-router";
import { Activity, Atom01, Home01, User01 } from "@untitledui/icons";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { cx } from "@/utils/cx";

const baseTabs = [
    { label: "Feed", href: "/feed", icon: Home01 },
    { label: "Activity", href: "/activity", icon: Activity },
    { label: "Profile", href: "/profile/me", icon: User01 },
];

export function BottomNav() {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const { profile } = useProfile();

    // Admins get a fourth tab that opens the admin view (defaults to Analytics).
    const tabs = profile?.is_admin
        ? [...baseTabs, { label: "Admin", href: "/admin", icon: Atom01 }]
        : baseTabs;

    // Profile highlights only for the logged-in user's own profile — not other
    // players' profiles (/profile/{uuid}).
    const isOwnProfile =
        pathname === "/profile/me" || pathname === "/profile" || (!!user && pathname === `/profile/${user.id}`);

    return (
        // In-flow (not fixed) so it sits at the bottom of the h-dvh shell as a flex
        // child. It used to be `fixed bottom-0`, but in the installed iOS PWA the
        // first paint anchors fixed elements to a viewport that hasn't applied
        // viewport-fit=cover yet, leaving the bar floating ~40px above the screen
        // edge until a gesture forced re-layout. Laying it out in flow — the same way
        // the Edit-profile action bar already works — sidesteps that entirely.
        //
        // The inset is clamped to 16px: the 68px row already carries its own bottom
        // breathing room, so the full ~34px home-indicator inset on top of it pushed
        // the tabs too high. Devices with no inset resolve to 0 and get exactly 68px.
        <nav className="shrink-0 bg-primary pb-[var(--safe-bottom)]">
            <div className="flex h-[68px] items-center">
                {tabs.map(({ label, href, icon: Icon }) => {
                    const active =
                        href === "/profile/me"
                            ? isOwnProfile
                            : pathname === href || (href !== "/feed" && pathname.startsWith(href));
                    return (
                        <Link
                            key={href}
                            to={href}
                            className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
                        >
                            <Icon
                                className={cx("size-5", active ? "text-primary" : "text-secondary")}
                                aria-hidden="true"
                            />
                            <span className={cx("text-xs", active ? "font-medium text-primary" : "text-secondary")}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
