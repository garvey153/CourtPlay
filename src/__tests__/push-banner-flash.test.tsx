import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { PushEnableBanner, usePushPrompt } from "@/components/app/push-enable-banner";
import { usePush } from "@/hooks/use-push";

/**
 * The "Turn on notifications" banner appeared for a second or two on every page
 * load, then vanished, for users who already had notifications enabled.
 *
 * usePush initialised `permissionGranted` to false and only read the real value
 * after ensureOneSignal() resolved — a dynamic import plus SDK init. During that
 * window consumers could not tell "not granted" from "not known yet", and the
 * banner rendered on the assumption of the former.
 *
 * The browser answers this synchronously via Notification.permission, so the
 * hook seeds from that. These tests assert the state on the *first* render,
 * before any effect has settled, which is where the flash lived.
 */

// react-onesignal is dynamically imported inside the hook. Left unresolved on
// purpose: the point is what the hook reports *before* the SDK is ready.
vi.mock("react-onesignal", () => ({ default: new Promise(() => {}) }));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn() })) })),
    },
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));

function setBrowserPermission(value: NotificationPermission) {
    Object.defineProperty(window, "Notification", {
        value: Object.assign(class {}, { permission: value }),
        writable: true,
        configurable: true,
    });
}

beforeEach(() => {
    localStorage.clear();
});

describe("usePush initial permission state", () => {
    it("reports granted on the first render, without waiting for OneSignal", () => {
        setBrowserPermission("granted");

        const { result } = renderHook(() => usePush());

        // Not `waitFor` — the whole bug was that this was false until the SDK
        // finished loading.
        expect(result.current.permissionGranted).toBe(true);
    });

    it("reports not-granted when the browser has not been asked", () => {
        setBrowserPermission("default");

        const { result } = renderHook(() => usePush());

        expect(result.current.permissionGranted).toBe(false);
    });

    it("reports not-granted when the browser denied", () => {
        setBrowserPermission("denied");

        const { result } = renderHook(() => usePush());

        expect(result.current.permissionGranted).toBe(false);
    });
});

/**
 * Visibility moved out of the card and into usePushPrompt, so the feed can
 * count its notifications before rendering any of them. The gate now has a
 * server half too: `eligible` is push_prompt_eligible (14 days since signup, an
 * action taken, no opt-in during onboarding).
 */
describe("usePushPrompt", () => {
    it("never shows for a user who already granted permission", () => {
        setBrowserPermission("granted");
        const { result } = renderHook(() => usePushPrompt(true));
        expect(result.current.visible).toBe(false);
    });

    it("shows for an eligible user who has not been asked", () => {
        setBrowserPermission("default");
        const { result } = renderHook(() => usePushPrompt(true));
        expect(result.current.visible).toBe(true);
    });

    it("stays hidden once dismissed on this device", () => {
        setBrowserPermission("default");
        localStorage.setItem("courtsub_push_prompt_dismissed", "true");
        const { result } = renderHook(() => usePushPrompt(true));
        expect(result.current.visible).toBe(false);
    });

    it("stays hidden while the server says it is not time to ask", () => {
        setBrowserPermission("default");
        const { result } = renderHook(() => usePushPrompt(false));
        expect(result.current.visible).toBe(false);
    });

    it("reports a denial as blocked rather than hiding", () => {
        setBrowserPermission("denied");
        const { result } = renderHook(() => usePushPrompt(true));
        expect(result.current.visible).toBe(true);
        expect(result.current.blocked).toBe(true);
    });

    it("is not visible where notifications are unsupported", () => {
        // @ts-expect-error — removing the API is the scenario.
        delete window.Notification;
        const { result } = renderHook(() => usePushPrompt(true));
        expect(result.current.visible).toBe(false);
    });
});

/**
 * A denial is permanent as far as the page is concerned: requestPermission()
 * resolves without prompting, so an "Enable" button does nothing observable.
 * The banner previously showed exactly that — the same copy and the same dead
 * button as for a user who simply hadn't been asked yet.
 */
const renderCard = (blocked: boolean) =>
    render(<PushEnableBanner blocked={blocked} requesting={false} onDismiss={vi.fn()} onEnable={vi.fn()} />);

describe("PushEnableBanner when notifications are blocked", () => {

    it("explains the block rather than offering to turn them on", async () => {
        renderCard(true);

        expect(await screen.findByText("Notifications are blocked.")).toBeInTheDocument();
        expect(screen.queryByText("Turn on notifications.")).not.toBeInTheDocument();
    });

    it("offers no Enable button, since it could not work", async () => {
        renderCard(true);

        await screen.findByText("Notifications are blocked.");
        expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();
    });

    it("can still be dismissed", async () => {
        renderCard(true);

        await screen.findByText("Notifications are blocked.");
        // Two affordances share the label: the corner ✕ and the text button.
        // Both remain when blocked — dismissing is the only thing left to do.
        expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(2);
    });

    it("points at where the setting actually lives", async () => {
        renderCard(true);

        expect(await screen.findByText(/browser or device settings/)).toBeInTheDocument();
    });
});

/*
 * "Renders nothing where notifications are unsupported" used to live here. The
 * card is presentational now and always renders what it is given, so that rule
 * belongs to the hook — see usePushPrompt above, which asserts it directly.
 */
