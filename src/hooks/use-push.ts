import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./use-auth";

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string;

type OneSignalSdk = typeof import("react-onesignal")["default"];

// OneSignal.init() throws "SDK already initialized" if called twice, but the hook
// is used by several components at once. Init exactly once per page load and share
// the resulting instance across every usePush() caller.
let initPromise: Promise<OneSignalSdk | null> | null = null;

/**
 * Record which device this user most recently subscribed on. Diagnostics only —
 * the server targets the OneSignal external id (see below), never this column.
 * A subscription id belongs to a browser rather than a person, so on a shared
 * device it moves between accounts and is not safe to target.
 */
async function storeSubscriptionId(OneSignal: OneSignalSdk) {
    const subId = OneSignal.User.PushSubscription.id;
    if (!subId) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
        await supabase.from("users").update({ onesignal_player_id: subId }).eq("id", data.user.id);
    }
}

function ensureOneSignal(): Promise<OneSignalSdk | null> {
    if (!ONESIGNAL_APP_ID) return Promise.resolve(null);
    if (!initPromise) {
        initPromise = (async () => {
            const OneSignal = (await import("react-onesignal")).default;
            await OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                allowLocalhostAsSecureOrigin: true,
                // Our VitePWA worker owns scope "/", so OneSignal's worker runs under
                // its own sub-scope to avoid clobbering it. File: public/push/onesignal/.
                serviceWorkerParam: { scope: "/push/onesignal/" },
                serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
            });
            // The subscription id can arrive after init settles, so store on change too.
            OneSignal.User.PushSubscription.addEventListener("change", () => void storeSubscriptionId(OneSignal));
            void storeSubscriptionId(OneSignal);
            return OneSignal;
        })();
    }
    return initPromise;
}

/**
 * Aliases this device's subscription to the app's user id, so the server can
 * target the *person* instead of a device. Without it, signing a second account
 * in on the same device leaves the subscription attached to the first — the new
 * account silently gets no push, and worse, notifications meant for the first
 * account keep landing on a device someone else is now using.
 */
async function syncExternalId(OneSignal: OneSignalSdk, userId: string | null) {
    if (userId) await OneSignal.login(userId);
    else await OneSignal.logout();
}

/** Initializes OneSignal (once) and provides push permission helpers. */
export function usePush() {
    const { user } = useAuth();
    // Depend on the id, not the object — the provider hands back a new reference
    // on every render, which would re-run login() continuously.
    const userId = user?.id ?? null;
    const [initialized, setInitialized] = useState(false);
    // Seeded synchronously from the browser rather than defaulting to false.
    // OneSignal's permission value is just this one, but it isn't readable until
    // the SDK has dynamically imported and initialised — a couple of seconds
    // during which consumers cannot distinguish "not granted" from "not known
    // yet". The push banner treated that as "not granted" and flashed on every
    // page load for users who had already enabled notifications.
    const [permissionGranted, setPermissionGranted] = useState(
        () => typeof Notification !== "undefined" && Notification.permission === "granted",
    );
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        ensureOneSignal()
            .then(async (OneSignal) => {
                if (!OneSignal || cancelled) return;
                try {
                    await syncExternalId(OneSignal, userId);
                } catch (e) {
                    if (!cancelled) setError(`externalId: ${e instanceof Error ? e.message : String(e)}`);
                }
                if (cancelled) return;
                setInitialized(true);
                setPermissionGranted(OneSignal.Notifications.permission);
            })
            .catch((e) => {
                if (!cancelled) setError(`init: ${e instanceof Error ? e.message : String(e)}`);
            });
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const requestPermission = useCallback(async () => {
        try {
            const OneSignal = await ensureOneSignal();
            if (!OneSignal) return false;
            // Re-assert the alias here too: the subscription may not have existed
            // when the effect ran, and it's the opt-in below that creates it.
            try {
                await syncExternalId(OneSignal, userId);
            } catch {
                // Non-fatal — permission still worth requesting.
            }
            await OneSignal.Notifications.requestPermission();
            // iOS needs an explicit opt-in to actually create the push subscription.
            try {
                await OneSignal.User.PushSubscription.optIn();
            } catch (e) {
                setError(`optIn: ${e instanceof Error ? e.message : String(e)}`);
            }
            const permission = OneSignal.Notifications.permission;
            setPermissionGranted(permission);
            if (permission) await storeSubscriptionId(OneSignal);
            return permission;
        } catch (e) {
            setError(`requestPermission: ${e instanceof Error ? e.message : String(e)}`);
            return false;
        }
    }, [userId]);

    return { initialized, permissionGranted, requestPermission, error };
}
