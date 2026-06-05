import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { PushPrompt } from "@/components/app/push-prompt";
import { usePush } from "@/hooks/use-push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (ui: any) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const mockRequestPermission = vi.fn().mockResolvedValue(true);

vi.mock("@/hooks/use-push", () => ({
    usePush: vi.fn(() => ({
        initialized: true,
        permissionGranted: false,
        requestPermission: mockRequestPermission,
    })),
}));

const mockUsePush = vi.mocked(usePush);

beforeEach(() => {
    Object.defineProperty(window, "Notification", { value: class {}, writable: true });
    localStorage.clear();
    mockRequestPermission.mockClear();
    mockUsePush.mockReturnValue({
        initialized: true,
        permissionGranted: false,
        requestPermission: mockRequestPermission,
    });
});

describe("PushPrompt", () => {
    it("push prompt shown after user creates first post", () => {
        render(<PushPrompt variant="post_created" />);
        expect(
            screen.getByText("Enable push notifications to know when someone claims your spot.")
        ).toBeInTheDocument();
    });

    it("push prompt shown after user views a post without claiming", () => {
        render(<PushPrompt variant="post_viewed" />);
        expect(
            screen.getByText("Get notified when prices drop or new spots open at your skill level.")
        ).toBeInTheDocument();
    });

    it("push prompt not shown if user already has onesignal_player_id", () => {
        mockUsePush.mockReturnValue({
            initialized: true,
            permissionGranted: true,
            requestPermission: mockRequestPermission,
        });

        const { container } = render(<PushPrompt variant="post_created" />);
        expect(container.innerHTML).toBe("");
    });

    it("push prompt dismissable", async () => {
        const user = userEvent.setup();
        render(<PushPrompt variant="post_created" />);

        expect(
            screen.getByText("Enable push notifications to know when someone claims your spot.")
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /not now/i }));

        await waitFor(() => {
            expect(
                screen.queryByText("Enable push notifications to know when someone claims your spot.")
            ).not.toBeInTheDocument();
        });
    });

    it("dismissal persists across sessions", async () => {
        const user = userEvent.setup();
        const { unmount } = render(<PushPrompt variant="post_created" />);

        await user.click(screen.getByRole("button", { name: /not now/i }));

        await waitFor(() => {
            expect(
                screen.queryByText("Enable push notifications to know when someone claims your spot.")
            ).not.toBeInTheDocument();
        });

        unmount();

        const { container } = render(<PushPrompt variant="post_created" />);
        expect(container.innerHTML).toBe("");
    });

    it("accepting push prompt stores onesignal_player_id", async () => {
        const user = userEvent.setup();
        render(<PushPrompt variant="post_created" />);

        await user.click(screen.getByRole("button", { name: /enable push/i }));

        await waitFor(() => {
            expect(mockRequestPermission).toHaveBeenCalledTimes(1);
        });
    });

    it("push prompt does not appear on first page load", () => {
        localStorage.setItem("courtsub_push_prompt_dismissed", "true");

        const { container } = render(<PushPrompt variant="post_created" />);
        expect(container.innerHTML).toBe("");
    });
});
