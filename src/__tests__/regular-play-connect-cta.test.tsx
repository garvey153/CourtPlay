import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { RegularPlaySheet } from "@/components/app/regular-play-sheet";
import { PRIMARY_CTA } from "@/components/base/buttons/cta";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

const post = {
    id: "rg-1", post_type: "regular_game", status: "active", author_id: "someone-else",
    first_name: "Chris", last_name: "B", photo_url: null, skill_level: "4.0",
    location: "Longshore Club", custom_court: null, notes: null, created_at: new Date().toISOString(),
    expires_at: null, game_date: null, game_time: null, format: null, play_type: null,
    duration: null, cost: null, original_cost: null, preferred_days: ["Mon"],
    preferred_times: ["Evening"], is_friend: false,
} as never;

/**
 * Connect was blue, matching the regular-play card's accent bar. The accent bar
 * still identifies regular play; the primary button is the primary button.
 *
 * Asserting the brand background AND the absence of the blue one matters: the
 * old code merged through cx precisely because appending alone would leave both
 * classes and let stylesheet order decide the winner.
 */
describe("regular play Connect CTA", () => {
    it("uses brand green, not blue", () => {
        render(
            <MemoryRouter>
                <RegularPlaySheet post={post} currentUserId="me" messages={[]} onClose={() => {}} />
            </MemoryRouter>,
        );
        const connect = screen.getByRole("button", { name: "Connect" });
        expect(connect.className).toContain("bg-brand-500");
        expect(connect.className).not.toContain("bg-blue-500");
        expect(connect.className).not.toContain("blue");
    });

    it("keeps the shared primary treatment rather than a local copy", () => {
        render(
            <MemoryRouter>
                <RegularPlaySheet post={post} currentUserId="me" messages={[]} onClose={() => {}} />
            </MemoryRouter>,
        );
        const connect = screen.getByRole("button", { name: "Connect" });
        // PRIMARY_BTN and PRIMARY_CTA share the brand background and dark text.
        for (const token of ["bg-brand-500", "text-neutral-950", "font-semibold"]) {
            expect(PRIMARY_CTA).toContain(token);
            expect(connect.className).toContain(token);
        }
    });
});
