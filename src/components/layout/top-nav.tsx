import { useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";

export function TopNav() {
    const navigate = useNavigate();
    return (
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-secondary bg-primary px-4">
            <span className="text-lg font-bold tracking-tight text-primary">CourtPlay</span>
            <Button
                color="primary"
                size="sm"
                className="rounded-pill"
                onClick={() => navigate("/post/new")}
            >
                Find a Sub
            </Button>
        </header>
    );
}
