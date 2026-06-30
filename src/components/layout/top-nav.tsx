import { useLocation, useNavigate } from "react-router";
import { FilterLines } from "@untitledui/icons";

interface TopNavProps {
    /** When provided (feed only), shows a filter icon that opens the feed filters. */
    onOpenFilters?: () => void;
    /** Shows an active dot on the filter icon when any filter is applied. */
    filtersActive?: boolean;
}

export function TopNav({ onOpenFilters, filtersActive }: TopNavProps) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    // The Post CTA is redundant on the post-creation screen itself.
    const showPostCta = pathname !== "/post/new";

    return (
        <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between bg-primary px-5">
            <img src="/courtplay-logo.svg" alt="CourtPlay" className="h-6 w-auto" />
            <div className="flex items-center gap-3">
                {onOpenFilters && (
                    <button
                        type="button"
                        onClick={onOpenFilters}
                        aria-label="Filter posts"
                        className="relative rounded-lg p-1.5 text-secondary transition duration-100 ease-linear hover:text-primary"
                    >
                        <FilterLines className="size-6" aria-hidden="true" />
                        {filtersActive && (
                            <span className="absolute right-1 top-1 size-2 rounded-full bg-brand-solid ring-2 ring-primary" />
                        )}
                    </button>
                )}
                {showPostCta && (
                    <button
                        type="button"
                        onClick={() => navigate("/post/new")}
                        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600"
                    >
                        Post
                    </button>
                )}
            </div>
        </header>
    );
}
