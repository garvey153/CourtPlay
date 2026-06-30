import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";

export function TopNav() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    // The Post CTA is redundant on the post-creation screen itself.
    const showPostCta = pathname !== "/post/new";

    return (
        <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between bg-primary px-5">
            <span className="text-xl font-bold tracking-tight">
                <span className="text-primary">Court</span>
                <span className="text-brand-secondary">Play</span>
            </span>
            {showPostCta && (
                <Button color="primary" size="sm" onClick={() => navigate("/post/new")}>
                    Post
                </Button>
            )}
        </header>
    );
}
