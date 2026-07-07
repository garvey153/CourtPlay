import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { FeedPost } from "@/types/feed";

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockInsert, mockInvoke } = vi.hoisted(() => ({
    mockInsert: vi.fn().mockResolvedValue({ error: null }),
    mockInvoke: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn().mockReturnValue({
            insert: mockInsert,
        }),
        functions: { invoke: mockInvoke },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "user-b" }, loading: false }),
}));

vi.mock("@/hooks/use-share", () => ({
    useShare: () => ({
        shareData: null,
        handleShare: vi.fn(),
        closeShareModal: vi.fn(),
    }),
}));

// Stub IntersectionObserver for SubCard tests
class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

// ── Helpers ───────────────────────────────────────────────────────────────

import { ReportModal } from "@/components/app/report-modal";
import { ClaimDetailSheet } from "@/components/app/claim-detail-sheet";

function renderModal(props: Partial<Parameters<typeof ReportModal>[0]> = {}) {
    const defaultProps = {
        targetType: "post" as const,
        targetId: "post-1",
        onClose: vi.fn(),
        ...props,
    };
    return {
        onClose: defaultProps.onClose,
        ...render(
            <MemoryRouter>
                <ReportModal {...defaultProps} />
            </MemoryRouter>,
        ),
    };
}

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1",
        author_id: "author-1",
        author_type: "player",
        post_type: "sub_need",
        status: "active",
        format: "point_play",
        total_players: 4,
        game_date: "2026-05-10",
        game_time: "09:00",
        skill_level: "4.0",
        location: "Longshore Club",
        court_id: "court-1",
        custom_court: null,
        pro_name: null,
        cost: 25,
        original_cost: null,
        spots_total: 4,
        spots_available: 2,
        view_count: 7,
        notes: null,
        series_id: null,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Jane",
        last_name: "Doe",
        photo_url: null,
        is_friend: false,
        user_claim_status: null,
        user_claim_id: null,
        user_notify_me: false,
        ...overrides,
    };
}

beforeEach(() => {
    mockInsert.mockClear();
    mockInvoke.mockClear();
    mockInsert.mockResolvedValue({ error: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ReportModal — post reporting", () => {
    it("report modal shows four reason options", () => {
        renderModal();
        expect(screen.getByLabelText("Spam")).toBeInTheDocument();
        expect(screen.getByLabelText("Inappropriate content")).toBeInTheDocument();
        expect(screen.getByLabelText("Incorrect information")).toBeInTheDocument();
        expect(screen.getByLabelText("Other")).toBeInTheDocument();
    });

    it("submit disabled without reason selection", () => {
        renderModal();
        const submitBtn = screen.getByRole("button", { name: /submit report/i });
        expect(submitBtn).toBeDisabled();
    });

    it("submit enabled after selecting a reason", async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByLabelText("Spam"));
        const submitBtn = screen.getByRole("button", { name: /submit report/i });
        expect(submitBtn).not.toBeDisabled();
    });

    it("note field accepts up to 150 characters", async () => {
        const user = userEvent.setup();
        renderModal();
        const textarea = screen.getByPlaceholderText("Tell us more...");
        const longText = "a".repeat(150);
        await user.type(textarea, longText);
        expect((textarea as HTMLTextAreaElement).value).toHaveLength(150);
    });

    it("note field is optional", async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByLabelText("Spam"));
        await user.click(screen.getByRole("button", { name: /submit report/i }));

        await waitFor(() => {
            expect(mockInsert).toHaveBeenCalledWith(
                expect.objectContaining({ note: null }),
            );
        });
    });

    it("successful report inserts correct row", async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByLabelText("Spam"));
        const textarea = screen.getByPlaceholderText("Tell us more...");
        await user.type(textarea, "Test note");
        await user.click(screen.getByRole("button", { name: /submit report/i }));

        await waitFor(() => {
            expect(mockInsert).toHaveBeenCalledWith({
                reporter_id: "user-b",
                target_type: "post",
                target_id: "post-1",
                reason: "spam",
                note: "Test note",
            });
        });
    });

    it("confirmation shown after successful report", async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByLabelText("Spam"));
        await user.click(screen.getByRole("button", { name: /submit report/i }));

        await waitFor(() => {
            expect(
                screen.getByText("Thanks for your report. Our team will review it."),
            ).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    });

    it("no notification sent to post author", async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByLabelText("Spam"));
        await user.click(screen.getByRole("button", { name: /submit report/i }));

        await waitFor(() => {
            expect(
                screen.getByText(/Thanks for your report/),
            ).toBeInTheDocument();
        });
        expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("error during submit shows error and keeps modal open", async () => {
        mockInsert.mockResolvedValueOnce({
            error: { message: "DB error", code: "500" },
        });
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByLabelText("Spam"));
        await user.click(screen.getByRole("button", { name: /submit report/i }));

        await waitFor(() => {
            expect(
                screen.getByText("Failed to submit report. Please try again."),
            ).toBeInTheDocument();
        });
        // Modal stays open — reason options still visible
        expect(screen.getByLabelText("Spam")).toBeInTheDocument();
    });

    it("submit button disabled during async operation", async () => {
        // Make insert hang until we resolve it
        let resolveInsert!: (v: { error: null }) => void;
        mockInsert.mockReturnValueOnce(
            new Promise((res) => {
                resolveInsert = res;
            }),
        );
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByLabelText("Spam"));
        await user.click(screen.getByRole("button", { name: /submit report/i }));

        // During submission the button should be effectively disabled (React Aria uses aria-disabled)
        const submitBtn = screen.getByRole("button", { name: /submit report/i });
        expect(submitBtn).toHaveAttribute("aria-disabled", "true");

        // Resolve to clean up
        resolveInsert({ error: null });
        await waitFor(() => {
            expect(screen.getByText(/Thanks for your report/)).toBeInTheDocument();
        });
    });

    it("self-report prevented — Report option not shown on own posts", () => {
        render(
            <MemoryRouter>
                <ClaimDetailSheet
                    post={makePost({ author_id: "user-b" })}
                    currentUserId="user-b"
                    onClose={vi.fn()}
                />
            </MemoryRouter>,
        );
        expect(screen.queryByText("Report claim")).not.toBeInTheDocument();
    });

    it("modal dismissable by clicking outside", async () => {
        const user = userEvent.setup();
        const { onClose } = renderModal();

        // The overlay is the outermost div with role="dialog"
        const overlay = screen.getByRole("dialog").parentElement ?? screen.getByRole("dialog");
        // Simulate mousedown on the overlay ref (the fixed backdrop)
        const backdrop = screen.getByRole("dialog");
        await user.pointer({ target: backdrop, keys: "[MouseLeft>]" });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("modal dismissable by Escape key", async () => {
        const user = userEvent.setup();
        const { onClose } = renderModal();

        await user.keyboard("{Escape}");

        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("claim-detail sheet offers Report issue link for other users' posts", () => {
        render(
            <MemoryRouter>
                <ClaimDetailSheet
                    post={makePost({ author_id: "author-1" })}
                    currentUserId="user-b"
                    onClose={vi.fn()}
                />
            </MemoryRouter>,
        );

        expect(screen.getByText("Report claim")).toBeInTheDocument();
    });

    it("Report option NOT shown to unauthenticated users", () => {
        render(
            <MemoryRouter>
                <ClaimDetailSheet post={makePost({ author_id: "author-1" })} onClose={vi.fn()} />
            </MemoryRouter>,
        );

        expect(screen.queryByText("Report claim")).not.toBeInTheDocument();
    });
});
