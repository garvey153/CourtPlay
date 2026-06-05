import { Link, useLocation } from "react-router";
import { Activity, Home01, User01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

const tabs = [
    { label: "Feed", href: "/feed", icon: Home01 },
    { label: "My Activity", href: "/activity", icon: Activity },
    { label: "Profile", href: "/profile/me", icon: User01 },
];

export function BottomNav() {
    const { pathname } = useLocation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t border-secondary bg-primary pb-safe">
            {tabs.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || (href !== "/feed" && pathname.startsWith(href.replace("/me", "")));
                return (
                    <Link
                        key={href}
                        to={href}
                        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
                    >
                        <Icon
                            className={cx("size-5", active ? "text-brand-primary" : "text-quaternary")}
                            aria-hidden="true"
                        />
                        <span className={cx("text-xs font-medium", active ? "text-brand-secondary" : "text-quaternary")}>
                            {label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
