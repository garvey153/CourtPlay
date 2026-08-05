import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupBanner } from "@/components/app/group-banner";
import type { GroupSummary } from "@/types/groups";

const group: GroupSummary = {
    id: "g-1",
    name: "The Racquettes",
    details: "Westport Social League",
    is_creator: false,
    is_closed: false,
    closed_at: null,
    joined_at: "2026-08-04T00:00:00Z",
    my_removed_at: null,
    removed_by_me: false,
    member_count: 3,
    members: [],
};

describe("GroupBanner", () => {
    it("tells you when you've been added, and offers to view the group", async () => {
        const user = userEvent.setup();
        const onView = vi.fn();
        render(<GroupBanner group={group} kind="added" onDismiss={vi.fn()} onView={onView} />);

        expect(screen.getByText("You're in a group")).toBeInTheDocument();
        expect(screen.getByText(/added to The Racquettes/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "View group" }));
        expect(onView).toHaveBeenCalledOnce();
    });

    it("explains that a closed group stays until you remove it", async () => {
        const user = userEvent.setup();
        const onView = vi.fn();
        render(
            <GroupBanner
                group={{ ...group, is_closed: true, closed_at: "2026-08-04T00:00:00Z" }}
                kind="closed"
                onDismiss={vi.fn()}
                onView={onView}
            />,
        );

        expect(screen.getByText("A group closed")).toBeInTheDocument();
        // The tombstone behaviour is the non-obvious part, so it is said outright.
        expect(screen.getByText(/stay on your profile until you remove it/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Remove it" }));
        expect(onView).toHaveBeenCalledOnce();
    });

    it("tells you when you've been removed, with no action to take", () => {
        render(
            <GroupBanner
                group={{ ...group, my_removed_at: "2026-08-04T00:00:00Z" }}
                kind="removed"
                onDismiss={vi.fn()}
                onView={vi.fn()}
            />,
        );
        expect(screen.getByText(/no longer in The Racquettes/)).toBeInTheDocument();
        // Nothing to open — the group is gone from their profile — so the only
        // affordances are the two dismissals.
        expect(screen.queryByRole("button", { name: "View group" })).toBeNull();
        expect(screen.getAllByRole("button")).toHaveLength(2);
    });

    it("dismisses from either the X or the text button", async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        render(<GroupBanner group={group} kind="added" onDismiss={onDismiss} onView={vi.fn()} />);

        // Both carry the accessible name "Dismiss" — the icon button via
        // aria-label, matching every other feed banner — so this asserts on the
        // pair rather than picking one.
        const dismissers = screen.getAllByRole("button", { name: "Dismiss" });
        expect(dismissers).toHaveLength(2);
        for (const b of dismissers) await user.click(b);
        expect(onDismiss).toHaveBeenCalledTimes(2);
    });
});
