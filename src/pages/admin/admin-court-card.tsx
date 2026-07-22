import { cx } from "@/utils/cx";

/** A court in the master locations list. */
export interface AdminCourtRow {
    id: string;
    name: string;
    area: string | null;
    active: boolean;
}

/** A custom court entered on a post. Lives only on the post; listed in the admin Custom section. */
export interface CustomCourtRow {
    id: string;
    court_name: string;
    submission_count: number;
    area: string | null;
}

type Tone = "active" | "custom";

const TONE_BAR: Record<Tone, string> = {
    active: "bg-brand-500",
    custom: "bg-amber-500",
};

interface AdminCourtCardProps {
    title: string;
    subtitle: string | null;
    tone: Tone;
    onOpen: () => void;
}

/**
 * Feed-style court card for the admin Courts tab (design 149:1330). Left accent bar is
 * green for courts in the master list, amber for custom courts submitted on posts.
 */
export function AdminCourtCard({ title, subtitle, tone, onOpen }: AdminCourtCardProps) {
    return (
        <button type="button" onClick={onOpen} className="flex w-full overflow-hidden rounded text-left">
            {/* Left status accent bar */}
            <span className={cx("w-1 shrink-0 self-stretch", TONE_BAR[tone])} aria-hidden="true" />

            {/* Card body */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 bg-secondary p-4 transition duration-100 ease-linear hover:bg-secondary_hover">
                <p className="truncate text-md font-semibold text-primary">{title}</p>
                {subtitle && <p className="truncate text-xs text-secondary">{subtitle}</p>}
            </div>
        </button>
    );
}
