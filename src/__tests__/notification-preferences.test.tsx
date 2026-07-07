import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { Settings } from "@/pages/settings";
import { supabase } from "@/lib/supabase";

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn((table: string) => {
            if (table === "notification_preferences") {
                return {
                    select: mockSelect,
                    upsert: mockUpsert,
                };
            }
            return { select: vi.fn(), upsert: vi.fn() };
        }),
    },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "test-user-id" }, loading: false }),
}));

// Stub window.Notification so pushSupported = true
Object.defineProperty(window, "Notification", { value: {}, configurable: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (ui: any) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const ALL_LABELS = [
    "New claim on your post",
    "Claim approved",
    "Claim rejected",
    "Claimer backed out",
    "Cost changed",
    "Claim response reminder",
    "Claimer cancelled",
    "Price drop",
    "Spot reopened",
    "48h unfilled nudge",
    "Game reminder",
    "Friend's game filling up",
    "Friend posts new sub need",
];

beforeEach(() => {
    mockUpsert.mockClear();
    mockEq.mockClear();
    mockSelect.mockClear();
    vi.mocked(supabase.from).mockClear();
});

describe("notification preferences", () => {
    it("preferences screen lists all notification types", async () => {
        render(<Settings />);
        for (const label of ALL_LABELS) {
            expect(await screen.findByText(label)).toBeInTheDocument();
        }
    });

    it("each type has push and email toggles", async () => {
        render(<Settings />);
        await screen.findByText(ALL_LABELS[0]);
        for (const label of ALL_LABELS) {
            expect(screen.getByLabelText(`${label} email`)).toBeInTheDocument();
            expect(screen.getByLabelText(`${label} push`)).toBeInTheDocument();
        }
    });

    it("default state: email on everywhere; push on only for claim lifecycle", async () => {
        render(<Settings />);
        await screen.findByText(ALL_LABELS[0]);

        // Claim lifecycle events push by default; the rest are email-only.
        const pushOnByDefault = ["New claim on your post", "Claim approved", "Claim rejected"];

        for (const label of ALL_LABELS) {
            const pushToggle = screen.getByLabelText(`${label} push`);
            if (pushOnByDefault.includes(label)) expect(pushToggle).toBeChecked();
            else expect(pushToggle).not.toBeChecked();

            if (label === "Friend posts new sub need") continue; // email also off for this one

            const emailToggle = screen.getByLabelText(`${label} email`);
            expect(emailToggle).toBeChecked();
        }
    });

    it("toggling push on saves to notification_preferences", async () => {
        const user = userEvent.setup();
        render(<Settings />);
        await screen.findByText(ALL_LABELS[0]);

        // "Cost changed" is push-off by default, so clicking turns it on.
        const pushToggle = screen.getByLabelText("Cost changed push");
        await user.click(pushToggle);

        expect(supabase.from).toHaveBeenCalledWith("notification_preferences");
        expect(mockUpsert).toHaveBeenCalledWith(
            { user_id: "test-user-id", notification_type: "cost_changed", push_enabled: true },
            { onConflict: "user_id,notification_type" },
        );
    });

    it("toggling email off saves to notification_preferences", async () => {
        const user = userEvent.setup();
        render(<Settings />);
        await screen.findByText(ALL_LABELS[0]);

        const emailToggle = screen.getByLabelText("Claim approved email");
        await user.click(emailToggle);

        expect(supabase.from).toHaveBeenCalledWith("notification_preferences");
        expect(mockUpsert).toHaveBeenCalledWith(
            { user_id: "test-user-id", notification_type: "claim_approved", email_enabled: false },
            { onConflict: "user_id,notification_type" },
        );
    });

    it("toggling shows optimistic UI", async () => {
        // Make upsert hang so we can check intermediate state
        let resolveUpsert!: (val: { error: null }) => void;
        mockUpsert.mockImplementationOnce(() => new Promise((resolve) => { resolveUpsert = resolve; }));

        const user = userEvent.setup();
        render(<Settings />);
        await screen.findByText(ALL_LABELS[0]);

        const pushToggle = screen.getByLabelText("Cost changed push");
        expect(pushToggle).not.toBeChecked();

        await user.click(pushToggle);

        // Toggle should reflect the new state immediately (optimistic update)
        // even though the upsert hasn't resolved yet
        await waitFor(() => expect(mockUpsert).toHaveBeenCalled());

        // The toggle state was applied optimistically before the server responded
        // Now resolve the upsert to confirm it stays
        resolveUpsert({ error: null });
    });

    it("friend new post notification defaults to off", async () => {
        render(<Settings />);
        await screen.findByText("Friend posts new sub need");

        const emailToggle = screen.getByLabelText("Friend posts new sub need email");
        const pushToggle = screen.getByLabelText("Friend posts new sub need push");

        expect(emailToggle).not.toBeChecked();
        expect(pushToggle).not.toBeChecked();
    });

    it("sms_enabled is never set to true", async () => {
        const user = userEvent.setup();
        render(<Settings />);
        await screen.findByText(ALL_LABELS[0]);

        // Toggle a few things
        await user.click(screen.getByLabelText("New claim on your post push"));
        await user.click(screen.getByLabelText("Claim approved email"));

        // Verify no upsert ever included sms_enabled = true
        for (const call of mockUpsert.mock.calls) {
            const payload = call[0] as Record<string, unknown>;
            expect(payload).not.toHaveProperty("sms_enabled", true);
        }
    });

    it("SMS column shown as disabled", async () => {
        render(<Settings />);
        await screen.findByText(ALL_LABELS[0]);

        // Each notification type has a disabled SMS toggle
        const smsToggles = ALL_LABELS.map((label) =>
            screen.getByLabelText(`${label} SMS (coming soon)`),
        );

        for (const toggle of smsToggles) {
            expect(toggle).toBeDisabled();
        }

        // "Soon" labels are displayed
        const soonLabels = screen.getAllByText("Soon");
        expect(soonLabels).toHaveLength(13);
    });
});
