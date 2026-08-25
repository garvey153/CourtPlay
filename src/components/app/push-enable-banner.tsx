import { useCallback, useEffect, useState } from "react";
import { XClose } from "@untitledui/icons";
import { usePush } from "@/hooks/use-push";

const DISMISSED_KEY = "courtsub_push_prompt_dismissed";

/**
 * Feed banner prompting the user to enable push notifications when they haven't
 * granted permission. Uses the shared confirmation-banner styling.
 */
/**
 * Whether to ask for push, and the two ways out of the ask.
 *
 * `eligible` is the server's answer (push_prompt_eligible): 14 days since
 * signup, at least one action taken, and no push opt-in during onboarding.
 * Everything decided here is the device's side of it — permission state and
 * whether this browser has already dismissed the banner.
 *
 * Split from the card so the feed can count its notifications before rendering
 * them; a component that returns null decides for itself and cannot be counted.
 */
export function usePushPrompt(eligible: boolean) {
    const { permission, requestPermission } = usePush();
    const [dismissed, setDismissed] = useState(true); // default hidden until we know
    const [requesting, setRequesting] = useState(false);

    useEffect(() => {
        if (permission === "granted") return;
        setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
    }, [permission]);

    const dismiss = useCallback(() => {
        setDismissed(true);
        localStorage.setItem(DISMISSED_KEY, "true");
    }, []);

    const enable = useCallback(async () => {
        setRequesting(true);
        await requestPermission();
        setRequesting(false);
        // Deliberately NOT dismissed here. Granting hides the banner on its own
        // (see `visible`); denying leaves it, now reading "blocked", because the
        // task the banner exists for did not get done.
    }, [requestPermission]);

    // Hide once granted, dismissed, where notifications aren't supported, or
    // where the server says it is not yet time to ask.
    const visible = eligible && permission !== "granted" && permission !== "unsupported" && !dismissed;

    // A denial is permanent as far as the page is concerned — requestPermission()
    // resolves without prompting, so an "Enable" button there offers something it
    // silently cannot do. Say what actually has to happen instead, and drop it.
    return { visible, blocked: permission === "denied", requesting, dismiss, enable };
}

export function PushEnableBanner({
    blocked,
    requesting,
    onDismiss: dismiss,
    onEnable: enable,
}: {
    blocked: boolean;
    requesting: boolean;
    onDismiss: () => void;
    onEnable: () => void;
}) {
    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">
                {blocked ? "Notifications are blocked." : "Turn on notifications."}
            </p>
            <p className="mt-1 text-sm text-secondary">
                {blocked
                    ? "Your browser is blocking notifications for CourtPlay. Re-enable them in your browser or device settings to hear about claims."
                    : "Get notified the moment your spots are claimed, approved, or declined."}
            </p>

            <div className="mt-3 flex items-center gap-3">
                <button
                    type="button"
                    onClick={dismiss}
                    className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Dismiss
                </button>
                {!blocked && (
                    <button
                        type="button"
                        onClick={enable}
                        disabled={requesting}
                        className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600 disabled:opacity-50 has-[[data-spinner]]:opacity-100"
                    >
                        {requesting ? "Enabling…" : "Enable"}
                    </button>
                )}
            </div>
        </div>
    );
}
