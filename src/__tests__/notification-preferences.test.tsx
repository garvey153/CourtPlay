import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { EditProfile } from "@/pages/edit-profile";
import { supabase } from "@/lib/supabase";
import { NOTIFICATION_TYPES } from "@/lib/notifications";

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

/**
 * Notification settings live behind the Notifications tab, so every test that
 * reads them has to open it first. Selected by ROLE — "Notifications" is also
 * the pane's own heading, and a bare text query matches both.
 */
const openNotifications = async () => {
    renderPage();
    const tab = await screen.findByRole("button", { name: "Notifications" });
    await userEvent.click(tab);
};

// Derived from the registry rather than duplicated. A hardcoded copy here was a
// fifth parallel list of notification types, and it went stale the moment the
// registry gained connection_request/connection_closed. What these tests are for
// is that the screen correctly *consumes* the registry; that the registry itself
// matches the server's DEFAULT_CHANNELS is notification-defaults.test.ts's job.
const VISIBLE = NOTIFICATION_TYPES.filter((t) => !t.adminOnly);
const ALL_LABELS = VISIBLE.map((t) => t.label);

beforeEach(() => {
    mockUpsert.mockClear();
    usersUpdate.mockClear();
    usersUpdateEq.mockClear();
    vi.mocked(supabase.from).mockClear();
});

describe("edit profile — notification preferences", () => {
    it("lists all 13 notification types", async () => {
        await openNotifications();
        for (const label of ALL_LABELS) {
            expect(await screen.findByText(label)).toBeInTheDocument();
        }
    });

    it("each type has email and push toggles, and no SMS column", async () => {
        await openNotifications();
        await screen.findByText(ALL_LABELS[0]);
        for (const label of ALL_LABELS) {
            expect(screen.getByLabelText(`${label} email`)).toBeInTheDocument();
            expect(screen.getByLabelText(`${label} push`)).toBeInTheDocument();
            expect(screen.queryByLabelText(`${label} SMS (coming soon)`)).not.toBeInTheDocument();
        }
        expect(screen.queryByText("Soon")).not.toBeInTheDocument();
    });

    it("default state: every toggle matches the registry's default for its type", async () => {
        await openNotifications();
        await screen.findByText(ALL_LABELS[0]);

        // Both channels derive from NOTIFICATION_TYPES rather than being spelled
        // out here. This used to assert "email on everywhere" with a hardcoded
        // exception for the one opt-in type, which meant every new opt-in type
        // broke the test rather than being covered by it.
        const pushOnByDefault = VISIBLE.filter((t) => t.defaultPush).map((t) => t.label);
        const emailOnByDefault = VISIBLE.filter((t) => t.defaultEmail).map((t) => t.label);
        for (const label of ALL_LABELS) {
            const pushToggle = screen.getByLabelText(`${label} push`);
            if (pushOnByDefault.includes(label)) expect(pushToggle).toBeChecked();
            else expect(pushToggle).not.toBeChecked();

            const emailToggle = screen.getByLabelText(`${label} email`);
            if (emailOnByDefault.includes(label)) expect(emailToggle).toBeChecked();
            else expect(emailToggle).not.toBeChecked();
        }
    });

    it("friend new post notification defaults to off", async () => {
        await openNotifications();
        await screen.findByText("Friend posts new sub need");
        expect(screen.getByLabelText("Friend posts new sub need email")).not.toBeChecked();
        expect(screen.getByLabelText("Friend posts new sub need push")).not.toBeChecked();
    });

    it("Save is disabled until something changes", async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Notifications" }));
        await screen.findByText(ALL_LABELS[0]);

        const save = screen.getByRole("button", { name: "Save changes" });
        expect(save).toBeDisabled();

        await user.click(screen.getByLabelText("Cost changed push"));
        expect(save).toBeEnabled();
    });

    it("saving upserts every non-admin preference including the toggled change, never SMS", async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Notifications" }));
        await screen.findByText(ALL_LABELS[0]);

        const save = screen.getByRole("button", { name: "Save changes" });
        await user.click(screen.getByLabelText("Cost changed push"));
        await user.click(save);

        await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
        const payload = mockUpsert.mock.calls[0][0] as Array<Record<string, unknown>>;
        expect(payload).toHaveLength(ALL_LABELS.length);
        const changed = payload.find((p) => p.notification_type === "cost_changed");
        expect(changed?.push_enabled).toBe(true);
        for (const p of payload) {
            expect(p).not.toHaveProperty("sms_enabled");
        }
        // ...and ONLY notification_preferences. Each tab saves its own table, so
        // saving here must not write the users row — an unsaved edit on the Edit
        // profile tab stays unsaved rather than riding along.
        expect(usersUpdate).not.toHaveBeenCalled();
    });

    it("saving the Edit profile tab writes the user row and no preferences", async () => {
        const user = userEvent.setup();
        renderPage();
        // Stay on the first tab and change something that lives there.
        await user.click(await screen.findByText("Only show posts from my groups and players I'm following."));

        const save = screen.getByRole("button", { name: "Save changes" });
        expect(save).toBeEnabled();
        await user.click(save);

        await waitFor(() => expect(usersUpdate).toHaveBeenCalled());
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("a notification edit does not enable Save on the Edit profile tab", async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Notifications" }));
        await user.click(screen.getByLabelText("Cost changed push"));
        expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

        await user.click(screen.getByRole("button", { name: "Edit profile" }));
        expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });
});
