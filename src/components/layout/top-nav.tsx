import { Link, useLocation, useNavigate } from "react-router";
import { BetaTag } from "@/components/app/beta-tag";
import { FilterButton } from "@/components/app/filter-button";

interface TopNavProps {
    /** When provided (feed only), shows a filter icon that opens the feed filters. */
    onOpenFilters?: () => void;
    /** Shows an active dot on the filter icon when any filter is applied. */
    filtersActive?: boolean;
}

export function TopNav({ onOpenFilters, filtersActive }: TopNavProps) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    // On the post-creation and edit-profile screens the CTA is redundant, so it's shown disabled.
    const postCtaDisabled = pathname === "/post/new" || pathname === "/profile/edit" || pathname === "/admin";

    return (
        <header className="sticky top-0 z-40 flex items-center justify-between bg-primary px-5 pb-4 pt-[calc(env(safe-area-inset-top)_+_1rem)]">
            {/* Logo + Beta tag (Figma 528:1739). The logo's viewBox is tight to the
                "y" — its right edge is exactly x=102 of 102 — so gap-2 lands the tag
                8px from the "y" as specced. The tag is nudged up 1px because the "P"
                spans y 3.25–18.86 in the 24px logo, centering ~0.95px above the
                logo's midpoint; that lines the tag's top and bottom up with the "P". */}
            <div className="flex items-center gap-2">
                <Link to="/feed" aria-label="Go to feed" className="transition duration-100 ease-linear hover:opacity-80">
                    <img src="/courtplay-logo.svg" alt="CourtPlay" className="h-6 w-auto" />
                </Link>
                <BetaTag />
            </div>
            <div className="flex items-center gap-3">
                {onOpenFilters && (
                    <FilterButton onClick={onOpenFilters} isActive={!!filtersActive} label="Filter posts" />
                )}
                <button
                    type="button"
                    onClick={() => navigate("/post/new")}
                    disabled={postCtaDisabled}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 has-[[data-spinner]]:opacity-100"
                >
                    Post
                </button>
            </div>
        </header>
    );
}
