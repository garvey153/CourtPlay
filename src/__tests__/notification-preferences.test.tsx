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
        // The user row is persisted in the same save. One button commits the whole
        // screen, so which tab is showing does not change what gets written.
        expect(usersUpdate).toHaveBeenCalled();
    });

    it("an edit on any tab enables the one Save button", async () => {
        const user = userEvent.setup();
        renderPage();

        // The Feed tab's only field.
        await user.click(await screen.findByRole("button", { name: "Feed" }));
        await user.click(screen.getByText("Only show posts from my groups and players I'm following."));
        expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

        // Still enabled after switching to the other tab — the button is shared.
        await user.click(screen.getByRole("button", { name: "Notifications" }));
        expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    });

    it("actions sit in one row, Cancel left and Save right", async () => {
        renderPage();
        const save = await screen.findByRole("button", { name: "Save changes" });
        const cancel = screen.getByRole("button", { name: "Cancel" });

        // Same row, and Cancel first in DOM order — which is what puts it on the
        // left under justify-between.
        expect(save.parentElement).toBe(cancel.parentElement);
        expect(save.parentElement!.className).toContain("justify-between");
        expect(save.parentElement!.className).not.toContain("flex-col");
        expect(cancel.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("the tabs and avatar scroll; only the header and action bar are fixed", async () => {
        renderPage();
        const tab = await screen.findByRole("button", { name: "Notifications" });
        const scroller = tab.closest(".overflow-y-auto") as HTMLElement;

        // Tabs live inside the scrolling body...
        expect(scroller).not.toBeNull();
        // ...above the avatar's Change photo control, which scrolls with them.
        const photo = screen.getByText("Change photo");
        expect(scroller.contains(photo)).toBe(true);
        expect(tab.compareDocumentPosition(photo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        // The header stays outside it.
        expect(scroller.contains(screen.getByRole("heading", { name: "Settings" }))).toBe(false);
    });

    it("the tabs show on both panes", async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Notifications" }));
        expect(screen.getByRole("button", { name: "Profile" })).toBeInTheDocument();
        expect(screen.getByText("Change photo")).toBeInTheDocument();
    });

    it("three tabs, and Feed holds only the feed setting", async () => {
        const user = userEvent.setup();
        renderPage();
        for (const label of ["Profile", "Notifications", "Feed"]) {
            expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
        }

        await user.click(screen.getByRole("button", { name: "Feed" }));
        expect(screen.getByText("Only show posts from my groups and players I'm following.")).toBeInTheDocument();
        // Nothing else came with it.
        expect(screen.queryByText("Personal info")).not.toBeInTheDocument();
        expect(screen.queryByText("Contact & Payment")).not.toBeInTheDocument();
        expect(screen.queryByText(ALL_LABELS[0])).not.toBeInTheDocument();
    });

    it("the feed setting is off the Profile tab now", async () => {
        renderPage();
        await screen.findByText("Personal info");
        expect(screen.queryByText("Only show posts from my groups and players I'm following.")).not.toBeInTheDocument();
    });

    it("the action bar carries the design's 16px above and 32px below", async () => {
        renderPage();
        const save = await screen.findByRole("button", { name: "Save changes" });
        const bar = save.parentElement!.parentElement!;
        // Figma 627:9347 — pt-[16px] pb-[32px], and the SM button pair (py-2),
        // which is what makes the bar 84px rather than 88.
        expect(bar.className).toContain("pt-4");
        expect(bar.className).toContain("pb-8");
        expect(save.className).toContain("py-2");
        expect(save.className).not.toContain("py-2.5");
    });

    it("sections sit 24px apart, per the design's stack", async () => {
        renderPage();
        const save = await screen.findByRole("button", { name: "Save changes" });
        const body = save.parentElement!.parentElement!.previousElementSibling as HTMLElement;
        expect(body.className).toContain("gap-6");
        expect(body.className).not.toContain("gap-8");
    });

    it("the action bar is pinned, not part of the scrolling form", async () => {
        renderPage();
        const save = await screen.findByRole("button", { name: "Save changes" });

        // A shrink-0 bar that FOLLOWS the scrolling body as its sibling — that
        // pairing is what keeps it on screen however far the form scrolls.
        //
        // Not closest(".overflow-y-auto"): AppLayout's own <main> is scrollable
        // and wraps everything, so that query always finds something and would
        // pass whether the bar were pinned or not.
        const bar = save.parentElement!.parentElement!;
        expect(bar.className).toContain("shrink-0");
        const body = bar.previousElementSibling as HTMLElement;
        expect(body.className).toContain("overflow-y-auto");
    });

    it("saving from the Feed tab still writes notification preferences", async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Feed" }));
        await user.click(screen.getByText("Only show posts from my groups and players I'm following."));
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() => expect(usersUpdate).toHaveBeenCalled());
        expect(mockUpsert).toHaveBeenCalled();
    });
});
