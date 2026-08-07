import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makePost } from "@/test/mocks/fixtures";
import { SubCard } from "@/components/app/sub-card";
import { TaggedDetailSheet } from "@/components/app/tagged-detail-sheet";
import { TaggedPostBanner } from "@/components/app/tagged-post-banner";
import type { FeedPost } from "@/types/feed";

// Mirrors report-post.test.tsx — the sheet pulls in ReportModal, which needs an
// auth'd user, and useShare, whose modal is not what's under test here.
vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
        functions: { invoke: vi.fn() },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "viewer-1" }, loading: false }),
}));

vi.mock("@/hooks/use-share", () => ({
    useShare: () => ({ shareData: null, handleShare: vi.fn(), closeShareModal: vi.fn() }),
}));

class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(_cb: IntersectionObserverCallback) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

// The shared fixture's game date is in the past, which resolves the card to
// "expired" — an inert state that would mask everything under test. Push it
// forward so these cases run against an open post.
const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

const post = (o: Record<string, unknown> = {}) =>
    makePost({ cost: 25, is_tagged: false, game_date: future, ...o }) as unknown as FeedPost;

/**
 * The tagged variant is what someone in the group the sub is playing with sees.
 * It is a viewer-relative treatment: the SAME post reads differently depending
 * on who is looking, which is why every case here is the same post with only
 * is_tagged flipped.
 */
describe("SubCard — tagged variant", () => {
    it("shows the price to an ordinary viewer", () => {
        render(<SubCard post={post()} />);
        expect(screen.getByText("$25")).toBeInTheDocument();
    });

    it("keeps the price for a tagged viewer, in the claimed treatment", () => {
        render(<SubCard post={post({ is_tagged: true })} />);
        const price = screen.getByText("$25");
        expect(price).toBeInTheDocument();
        // Tertiary — the same as a claimed post. The money isn't this viewer's
        // to pay, so it reads as settled rather than on offer. The TITLE stays a
        // step brighter at secondary, which is what keeps the two distinct.
        expect(price.className).toContain("text-tertiary");
        expect(screen.getByText(/Tennis/).className).toContain("text-secondary");
    });

    it("names the group in the byline, which is why the post is in your feed", () => {
        render(<SubCard post={post({ is_tagged: true, tagged_group_name: "The Racquettes" })} />);
        expect(screen.getByText(/The Racquettes/)).toBeInTheDocument();
        expect(screen.getByText(/^Test · The Racquettes · /)).toBeInTheDocument();
    });

    it("leaves the byline alone for an ordinary viewer", () => {
        render(<SubCard post={post({ tagged_group_name: "The Racquettes" })} />);
        expect(screen.queryByText(/The Racquettes/)).not.toBeInTheDocument();
    });

    it("a claimed tagged post keeps the claimed dimming — status carries more", () => {
        render(<SubCard post={post({ is_tagged: true, spots_available: 0 })} />);
        expect(screen.getByText("$25").className).toContain("text-tertiary");
    });

    it("keeps the status badge — a player in the game still wants to know it's open", () => {
        render(<SubCard post={post({ is_tagged: true })} />);
        expect(screen.getByText("Open")).toBeInTheDocument();
    });

    it("steps the accent bar down to brand-800, leaving the badge dot alone", () => {
        // Scoped to the bar (the leading w-1 span). A bare search for
        // .bg-brand-500 would also match the Open badge's dot, which correctly
        // keeps its colour — the status still reads as open.
        const bar = (p: FeedPost) => render(<SubCard post={p} />).container.querySelector("span.w-1");
        expect(bar(post({ is_tagged: true }))?.className).toContain("bg-brand-800");
        expect(bar(post())?.className).toContain("bg-brand-500");
    });

    it("still opens its sheet — tagged is quieter, not inert", async () => {
        const onOpenDetail = vi.fn();
        const user = userEvent.setup();
        render(<SubCard post={post({ is_tagged: true })} onOpenDetail={onOpenDetail} />);
        await user.click(screen.getByText(/Tennis/));
        expect(onOpenDetail).toHaveBeenCalled();
    });
});

describe("TaggedDetailSheet", () => {
    it("offers sharing instead of claiming", () => {
        render(<TaggedDetailSheet post={post({ is_tagged: true })} groupName="The Racquettes" onClose={vi.fn()} />);
        expect(screen.getByRole("button", { name: "Share with a friend" })).toBeInTheDocument();
        // The real claim action is labelled "Claim for $25" / "Claim spot".
        // Matching /claim/i alone would also catch the Report claim link.
        expect(screen.queryByRole("button", { name: /^Claim (for|spot)/i })).not.toBeInTheDocument();
    });

    it("names the group, so it's clear why you're seeing the post", () => {
        render(<TaggedDetailSheet post={post({ is_tagged: true })} groupName="The Racquettes" onClose={vi.fn()} />);
        expect(screen.getByText("The Racquettes")).toBeInTheDocument();
        expect(screen.getByText(/will be notified with status updates/)).toBeInTheDocument();
    });

    it("falls back rather than printing nothing when the name is missing", () => {
        render(<TaggedDetailSheet post={post({ is_tagged: true })} groupName={null} onClose={vi.fn()} />);
        expect(screen.getByText("your group")).toBeInTheDocument();
    });

    it("shows no price — the money isn't this viewer's to pay", () => {
        render(<TaggedDetailSheet post={post({ is_tagged: true })} groupName="G" onClose={vi.fn()} />);
        expect(screen.queryByText("$25")).not.toBeInTheDocument();
    });

    it("keeps a way to report the post", async () => {
        const user = userEvent.setup();
        render(<TaggedDetailSheet post={post({ is_tagged: true })} groupName="G" onClose={vi.fn()} />);
        await user.click(screen.getByRole("button", { name: "Report claim" }));
        expect(screen.queryByRole("button", { name: "Share with a friend" })).not.toBeInTheDocument();
    });
});

describe("TaggedPostBanner", () => {
    const tagged = {
        id: "p1", play_type: "doubles", format: null, game_date: future, game_time: "09:00",
        location: "Longshore Club", custom_court: null, created_at: new Date().toISOString(),
        group_name: "The Racquettes", poster_first_name: "Chris",
        claim_id: "c1", claim_status: "pending" as const, claimer_first_name: "Sara",
    };

    it("names who claimed the spot, and says it's not settled yet", () => {
        render(<TaggedPostBanner post={tagged} kind="claimed" onDismiss={vi.fn()} onView={vi.fn()} />);
        expect(screen.getByText(/Sara/)).toBeInTheDocument();
        expect(screen.getByText(/Waiting on approval/)).toBeInTheDocument();
    });

    it("says who is filling the spot once approved", () => {
        render(
            <TaggedPostBanner
                post={{ ...tagged, claim_status: "approved" }}
                kind="approved"
                onDismiss={vi.fn()}
                onView={vi.fn()}
            />,
        );
        expect(screen.getByText("Your sub is confirmed")).toBeInTheDocument();
        expect(screen.getByText(/Sara is filling the spot/)).toBeInTheDocument();
    });

    it("falls back rather than printing nothing when the claimer name is missing", () => {
        render(
            <TaggedPostBanner
                post={{ ...tagged, claimer_first_name: null }}
                kind="claimed"
                onDismiss={vi.fn()}
                onView={vi.fn()}
            />,
        );
        // Scoped to the body line — the heading also begins "Someone claimed".
        expect(screen.getByText(/Someone claimed the spot/)).toBeInTheDocument();
    });

    it("can be dismissed and opened", async () => {
        const onDismiss = vi.fn();
        const onView = vi.fn();
        const user = userEvent.setup();
        render(<TaggedPostBanner post={tagged} kind="claimed" onDismiss={onDismiss} onView={onView} />);
        await user.click(screen.getByRole("button", { name: "View post" }));
        expect(onView).toHaveBeenCalled();
        // Two dismiss affordances, as on GroupBanner: the X carries an
        // aria-label, the text button carries text. getByText picks the latter.
        await user.click(screen.getByText("Dismiss"));
        expect(onDismiss).toHaveBeenCalled();
    });
});

/**
 * The Friend badge takes its colour FROM the card's status rather than having
 * one of its own — background = the status text colour, text = the card
 * background. So it stays part of the status as the status changes.
 */
describe("FriendBadge on a post card", () => {
    const friend = (o: Record<string, unknown> = {}) => post({ is_friend: true, ...o });

    it("is green while the post is open", () => {
        render(<SubCard post={friend()} />);
        const badge = screen.getByText("Friend");
        expect(badge.className).toContain("bg-brand-500");
        expect(badge.className).toContain("text-[var(--color-bg-secondary)]");
    });

    it("follows the status to neutral once claimed", () => {
        render(<SubCard post={friend({ spots_available: 0 })} />);
        const badge = screen.getByText("Friend");
        expect(badge.className).toContain("bg-neutral-400");
        expect(badge.className).not.toContain("bg-brand-500");
    });

    it("carries no colour of its own — the old fixed blue is gone", () => {
        render(<SubCard post={friend()} />);
        const badge = screen.getByText("Friend");
        expect(badge.className).not.toContain("bg-blue-900");
        expect(badge.className).not.toContain("text-blue-400");
    });

    it("is absent when the poster isn't a friend", () => {
        render(<SubCard post={post()} />);
        expect(screen.queryByText("Friend")).not.toBeInTheDocument();
    });
});
