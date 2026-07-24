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
        // The bar is full-bleed to the bottom edge so its background sits behind the
        // home indicator, while the 68px tab row stays a fixed height on every device.
        // The safe-area inset is clamped to 16px: the design's 68px row already carries
        // its own bottom breathing room, so adding the full ~34px inset on top of it
        // left the tabs floating well above the screen edge. Devices with no inset
        // (older iPhones, Android, desktop) resolve to 0 and get exactly 68px.
        <nav className="fixed inset-x-0 bottom-0 z-40 bg-primary pb-[var(--safe-bottom)]">
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
