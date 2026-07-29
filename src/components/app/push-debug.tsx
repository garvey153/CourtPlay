import { useCallback, useState } from "react";
import { usePush } from "@/hooks/use-push";
import { supabase } from "@/lib/supabase";

type Readout = Record<string, string>;

/**
 * On-device push diagnostics. iOS PWAs can't easily be inspected from a desktop,
 * so this reads the live OneSignal SDK + service-worker state and shows it right
 * on the phone. Surfaced only behind a tap on the Profile version stamp (own
 * profile). Temporary debugging aid — remove once push is confirmed working.
 */
export function PushDebug() {
    const { initialized, permissionGranted, requestPermission, error } = usePush();
    const [readout, setReadout] = useState<Readout>({});
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        setBusy(true);
        const out: Readout = {};
        try {
            out.standalone = String(
                window.matchMedia?.("(display-mode: standalone)")?.matches ??
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (navigator as any).standalone ??
                    "?",
            );
            out.notifSupported = String("Notification" in window);
            out.notifPermission = "Notification" in window ? Notification.permission : "n/a";
            out.appIdSet = String(Boolean(import.meta.env.VITE_ONESIGNAL_APP_ID));
            out.initialized = String(initialized);
            out.hookError = error ?? "none";

            const OneSignal = (await import("react-onesignal")).default;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const OS = OneSignal as any;
            out.osPermission = String(OS.Notifications?.permission);
            out.osPermissionNative = String(OS.Notifications?.permissionNative ?? "?");
            out.subscriptionId = String(OS.User?.PushSubscription?.id ?? "null");
            out.optedIn = String(OS.User?.PushSubscription?.optedIn ?? "?");
            out.hasToken = String(Boolean(OS.User?.PushSubscription?.token));
            out.onesignalId = String(OS.User?.onesignalId ?? "null");

            if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                out.swScopes = regs.map((r) => r.scope).join(" | ") || "none";
            }
        } catch (e) {
            out.readError = e instanceof Error ? e.message : String(e);
        }
        setReadout(out);
        setBusy(false);
    }, [initialized, error]);

    const subscribe = useCallback(async () => {
        setBusy(true);
        await requestPermission();
        await refresh();
    }, [requestPermission, refresh]);

    /**
     * Asks the server to push at this device. The welcome notification OneSignal
     * sends on subscribe only proves the browser leg; this is the only way to see
     * whether our edge function can actually reach the stored subscription id.
     */
    const testPush = useCallback(async () => {
        setBusy(true);
        const out: Readout = {};
        try {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) {
                out.testPush = "not signed in";
            } else {
                const { data, error: fnError } = await supabase.functions.invoke("send-notification", {
                    body: { user_id: auth.user.id, notification_type: "claim_submitted", test: true },
                });
                out.testPush = fnError ? `error: ${fnError.message}` : JSON.stringify(data);
            }
        } catch (e) {
            out.testPush = e instanceof Error ? e.message : String(e);
        }
        setReadout((prev) => ({ ...prev, ...out }));
        setBusy(false);
    }, []);

    return (
        <div className="mt-4 w-full rounded-lg border border-secondary bg-secondary p-3 text-left">
            <p className="mb-2 text-xs font-semibold text-secondary">Push diagnostics</p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={refresh}
                    disabled={busy}
                    className="rounded-md bg-tertiary px-3 py-1.5 text-xs font-medium text-secondary disabled:opacity-50"
                >
                    Read state
                </button>
                <button
                    type="button"
                    onClick={subscribe}
                    disabled={busy}
                    className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
                >
                    Subscribe
                </button>
                <button
                    type="button"
                    onClick={testPush}
                    disabled={busy}
                    className="rounded-md bg-tertiary px-3 py-1.5 text-xs font-medium text-secondary disabled:opacity-50"
                >
                    Test push
                </button>
            </div>
            {Object.keys(readout).length > 0 && (
                <dl className="mt-3 flex flex-col gap-1">
                    {Object.entries(readout).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                            <dt className="shrink-0 text-tertiary">{k}:</dt>
                            <dd className="min-w-0 break-all font-mono text-secondary">{v}</dd>
                        </div>
                    ))}
                </dl>
            )}
            <p className="mt-2 text-[10px] text-quaternary">permissionGranted: {String(permissionGranted)}</p>
        </div>
    );
}
