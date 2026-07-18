import { useCallback, useEffect, useState } from "react";
import { XClose } from "@untitledui/icons";
import { usePush } from "@/hooks/use-push";

const DISMISSED_KEY = "courtsub_push_prompt_dismissed";

/**
 * Feed banner prompting the user to enable push notifications when they haven't
 * granted permission. Uses the shared confirmation-banner styling.
 */
export function PushEnableBanner() {
    const { permissionGranted, requestPermission } = usePush();
    const [dismissed, setDismissed] = useState(true); // default hidden until we know
    const [requesting, setRequesting] = useState(false);

    useEffect(() => {
        if (permissionGranted) return;
        setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
    }, [permissionGranted]);

    const dismiss = useCallback(() => {
        setDismissed(true);
        localStorage.setItem(DISMISSED_KEY, "true");
    }, []);

    const enable = useCallback(async () => {
        setRequesting(true);
        await requestPermission();
        setRequesting(false);
        setDismissed(true);
    }, [requestPermission]);

    // Hide once granted, dismissed, or in a browser without notification support.
    if (permissionGranted || dismissed || !("Notification" in window)) return null;

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

            <p className="pr-6 text-sm font-semibold text-primary">Turn on notifications.</p>
            <p className="mt-1 text-sm text-secondary">
                Get notified the moment your spots are claimed, approved, or declined.
            </p>

            <div className="mt-3 flex items-center gap-3">
                <button
                    type="button"
                    onClick={dismiss}
                    className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Dismiss
                </button>
                <button
                    type="button"
                    onClick={enable}
                    disabled={requesting}
                    className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600 disabled:opacity-50"
                >
                    {requesting ? "Enabling…" : "Enable"}
                </button>
            </div>
        </div>
    );
}
