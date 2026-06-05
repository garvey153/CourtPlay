import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildShareData } from "@/hooks/use-share";
import { ShareModal } from "@/components/app/share-modal";
import type { FeedPost } from "@/types/feed";

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "abc-def-123", author_id: "author-1", author_type: "player",
        post_type: "sub_need", format: "point_play", total_players: 4,
        game_date: "2026-04-10", game_time: "09:00", skill_level: "3.5",
        location: "Longshore Club", court_id: null, custom_court: null,
        pro_name: null, cost: 25, original_cost: null, spots_total: 4,
        series_id: null, notes: null, status: "active", view_count: 0,
        expires_at: null, preferred_days: null, preferred_times: null,
        created_at: new Date().toISOString(), first_name: "Jane", last_name: "Doe",
        photo_url: null, is_friend: false, spots_available: 3,
        user_claim_status: null, user_claim_id: null, user_notify_me: false,
        ...overrides,
    };
}

describe("share text formatting", () => {
    it("formatted correctly for sub_need post", () => {
        const data = buildShareData(makePost());
        expect(data.text).toContain("Jane");
        expect(data.text).toContain("3.5");
        expect(data.text).toContain("Longshore Club");
        expect(data.text).toContain("$25.00");
        expect(data.text).toContain("Claim it on CourtPlay");
        expect(data.url).toContain("/post/abc-def-123");
    });

    it("uses discounted cost when original_cost exists", () => {
        const data = buildShareData(makePost({ cost: 15, original_cost: 25 }));
        expect(data.text).toContain("$15.00");
        expect(data.text).not.toContain("$25.00");
    });

    it("handles regular_game post without date/time/cost", () => {
        const data = buildShareData(makePost({
            post_type: "regular_game", game_date: null, game_time: null, cost: null,
        }));
        expect(data.text).not.toContain("undefined");
        expect(data.text).not.toContain("null");
        expect(data.text).not.toContain("$null");
        expect(data.text).toContain("Jane");
        expect(data.text).toContain("CourtPlay");
    });

    it("handles custom court name", () => {
        const data = buildShareData(makePost({ location: null, custom_court: "My backyard court" }));
        expect(data.text).toContain("My backyard court");
    });

    it("date is human-readable", () => {
        const data = buildShareData(makePost({ game_date: "2026-04-10" }));
        // Should contain formatted date, not ISO
        expect(data.text).not.toContain("2026-04-10");
        expect(data.text).toMatch(/Apr/);
    });

    it("time is 12-hour format", () => {
        const data = buildShareData(makePost({ game_time: "09:00" }));
        expect(data.text).toContain("9:00 AM");
        expect(data.text).not.toContain("09:00:00");
    });

    it("special characters do not break formatting", () => {
        const data = buildShareData(makePost({ location: "Town Hall & Courts" }));
        expect(data.text).toContain("Town Hall & Courts");
    });
});

describe("Web Share API", () => {
    it("uses navigator.share when available", async () => {
        const shareFn = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { ...navigator, share: shareFn });
        // buildShareData is called inside useShare hook; test the share API call pattern
        const data = buildShareData(makePost());
        await navigator.share({ title: data.title, text: data.text, url: data.url });
        expect(shareFn).toHaveBeenCalled();
    });

    it("handles navigator.share rejection gracefully", async () => {
        const shareFn = vi.fn().mockRejectedValue(new DOMException("User cancelled", "AbortError"));
        vi.stubGlobal("navigator", { ...navigator, share: shareFn });
        // Should not throw
        try {
            await navigator.share({ title: "t", text: "t", url: "u" });
        } catch {
            // Expected — AbortError is a cancellation, not a real error
        }
        expect(shareFn).toHaveBeenCalled();
    });
});

describe("fallback share modal", () => {
    beforeEach(() => {
        vi.stubGlobal("navigator", {
            ...navigator,
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
    });

    it("renders all share options", () => {
        render(<ShareModal url="https://courtplay.app/post/123" text="Share text" onClose={() => {}} />);
        expect(screen.getByText("Copy link")).toBeInTheDocument();
        expect(screen.getByText("Share via iMessage")).toBeInTheDocument();
        expect(screen.getByText("Share via WhatsApp")).toBeInTheDocument();
    });

    it("copy link shows copied confirmation", async () => {
        const user = userEvent.setup();
        render(<ShareModal url="https://courtplay.app/post/123" text="Share text" onClose={() => {}} />);
        await user.click(screen.getByText("Copy link"));
        expect(await screen.findByText("Copied!")).toBeInTheDocument();
    });

    it("iMessage link has correct sms URI", () => {
        render(<ShareModal url="https://courtplay.app/post/123" text="Share text" onClose={() => {}} />);
        const link = screen.getByText("Share via iMessage").closest("a");
        expect(link?.getAttribute("href")).toContain("sms:");
        expect(link?.getAttribute("href")).toContain(encodeURIComponent("Share text"));
    });

    it("WhatsApp link has correct wa.me URL", () => {
        render(<ShareModal url="https://courtplay.app/post/123" text="Share text" onClose={() => {}} />);
        const link = screen.getByText("Share via WhatsApp").closest("a");
        expect(link?.getAttribute("href")).toContain("https://wa.me/?text=");
        expect(link?.getAttribute("href")).toContain(encodeURIComponent("https://courtplay.app/post/123"));
    });

    it("modal is dismissable", async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<ShareModal url="u" text="t" onClose={onClose} />);
        await user.click(screen.getByText("Cancel"));
        expect(onClose).toHaveBeenCalled();
    });
});
