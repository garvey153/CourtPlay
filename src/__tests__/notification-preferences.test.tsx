import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { EditProfile } from "@/pages/edit-profile";
import { supabase } from "@/lib/supabase";

// The notification prefs now live in the Edit profile page. Changes are staged
// locally and persisted together on "Save changes" (not per-toggle), and there
// is no SMS column.

const USER_ROW = {
    first_name: "Kate",
    last_name: "Garvey",
    email: "kate@example.com",
    skill_level: "4.0",
    court_preferences: [],
    new_to_westport: false,
    phone: null,
    venmo_handle: null,
    photo_url: null,
};

const usersSingle = vi.fn().mockResolvedValue({ data: USER_ROW, error: null });
const usersUpdateEq = vi.fn().mockResolvedValue({ error: null });
const usersUpdate = vi.fn().mockReturnValue({ eq: usersUpdateEq });
const notifSelectEq = vi.fn().mockResolvedValue({ data: [], error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn((table: string) => {
            if (table === "courts") {
                return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) };
            }
            if (table === "users") {
                return { select: () => ({ eq: () => ({ single: usersSingle }) }), update: usersUpdate };
            }
            if (table === "notification_preferences") {
                return { select: () => ({ eq: notifSelectEq }), upsert: mockUpsert };
            }
            return { select: vi.fn(), upsert: vi.fn() };
        }),
        rpc: vi.fn().mockResolvedValue({ data: null }),
        storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
    },
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({ user: { id: "test-user-id", email: "kate@example.com" }, loading: false }),
}));

const renderPage = () => render(<EditProfile />, { wrapper: MemoryRouter });

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
    usersUpdate.mockClear();
    usersUpdateEq.mockClear();
    vi.mocked(supabase.from).mockClear();
});

describe("edit profile — notification preferences", () => {
    it("lists all 13 notification types", async () => {
        renderPage();
        for (const label of ALL_LABELS) {
            expect(await screen.findByText(label)).toBeInTheDocument();
        }
    });

    it("each type has email and push toggles, and no SMS column", async () => {
        renderPage();
        await screen.findByText(ALL_LABELS[0]);
        for (const label of ALL_LABELS) {
            expect(screen.getByLabelText(`${label} email`)).toBeInTheDocument();
            expect(screen.getByLabelText(`${label} push`)).toBeInTheDocument();
            expect(screen.queryByLabelText(`${label} SMS (coming soon)`)).not.toBeInTheDocument();
        }
        expect(screen.queryByText("Soon")).not.toBeInTheDocument();
    });

    it("default state: email on everywhere; push on only for claim lifecycle", async () => {
        renderPage();
        await screen.findByText(ALL_LABELS[0]);

        const pushOnByDefault = ["New claim on your post", "Claim approved", "Claim rejected"];
        for (const label of ALL_LABELS) {
            const pushToggle = screen.getByLabelText(`${label} push`);
            if (pushOnByDefault.includes(label)) expect(pushToggle).toBeChecked();
            else expect(pushToggle).not.toBeChecked();

            if (label === "Friend posts new sub need") continue; // email also off for this one
            expect(screen.getByLabelText(`${label} email`)).toBeChecked();
        }
    });

    it("friend new post notification defaults to off", async () => {
        renderPage();
        await screen.findByText("Friend posts new sub need");
        expect(screen.getByLabelText("Friend posts new sub need email")).not.toBeChecked();
        expect(screen.getByLabelText("Friend posts new sub need push")).not.toBeChecked();
    });

    it("Save is disabled until something changes", async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText(ALL_LABELS[0]);

        const save = screen.getByRole("button", { name: "Save changes" });
        expect(save).toBeDisabled();

        await user.click(screen.getByLabelText("Cost changed push"));
        expect(save).toBeEnabled();
    });

    it("saving upserts all 13 preferences including the toggled change, never SMS", async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText(ALL_LABELS[0]);

        const save = screen.getByRole("button", { name: "Save changes" });
        await user.click(screen.getByLabelText("Cost changed push"));
        await user.click(save);

        await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
        const payload = mockUpsert.mock.calls[0][0] as Array<Record<string, unknown>>;
        expect(payload).toHaveLength(13);
        const changed = payload.find((p) => p.notification_type === "cost_changed");
        expect(changed?.push_enabled).toBe(true);
        for (const p of payload) {
            expect(p).not.toHaveProperty("sms_enabled");
        }
        // The user row is persisted too.
        expect(usersUpdate).toHaveBeenCalled();
    });
});
