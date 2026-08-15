import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminInviteCard, type AdminInviteRow } from "@/pages/admin/admin-invite-card";
import { KIND_CONFIG } from "@/components/app/sub-card";

const row = (over: Partial<AdminInviteRow> = {}): AdminInviteRow => ({
    id: "1",
    email: "jane@example.com",
    source: "admin",
    sent_at: "2026-08-15T12:00:00Z",
    accepted_at: null,
    accepted_user_id: null,
    inviter_name: null,
    accepted_name: null,
    ...over,
});

/**
 * An outstanding invite used to render with NO badge, so "waiting" and "joined"
 * were told apart only by a 4px bar. That mattered beyond looks: the detail sheet
 * offers Remove only while an invite is outstanding, so a row that read as joined
 * looked like one that could not be revoked.
 */
describe("AdminInviteCard", () => {
    it("badges an outstanding invite as Pending", () => {
        render(<AdminInviteCard invite={row()} onOpen={() => {}} />);
        expect(screen.getByText("Pending")).toBeInTheDocument();
        expect(screen.queryByText("Joined")).not.toBeInTheDocument();
    });

    it("badges an accepted invite as Joined", () => {
        render(<AdminInviteCard invite={row({ accepted_at: "2026-08-15T13:00:00Z" })} onOpen={() => {}} />);
        expect(screen.getByText("Joined")).toBeInTheDocument();
        expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    });

    /** Pending must keep using the shared neutral pair, not a one-off colour. */
    it("styles Pending with the same colours posts use", () => {
        render(<AdminInviteCard invite={row()} onOpen={() => {}} />);
        const badge = screen.getByText("Pending");
        expect(badge.className).toContain(KIND_CONFIG.pending.badgeBg);
        expect(badge.className).toContain(KIND_CONFIG.pending.badgeFg);
        // The same pair Claimed uses — that equality is the design requirement.
        expect(KIND_CONFIG.pending.badgeBg).toBe(KIND_CONFIG.claimed.badgeBg);
        expect(KIND_CONFIG.pending.badgeFg).toBe(KIND_CONFIG.claimed.badgeFg);
    });

    it("keeps Joined on the brand colours", () => {
        render(<AdminInviteCard invite={row({ accepted_at: "2026-08-15T13:00:00Z" })} onOpen={() => {}} />);
        expect(screen.getByText("Joined").className).toContain("bg-brand-800");
    });
});
