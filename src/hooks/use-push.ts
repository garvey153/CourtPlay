import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./use-auth";

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string;

type OneSignalSdk = typeof import("react-onesignal")["default"];

// OneSignal.init() throws "SDK already initialized" if called twice, but the hook
// is used by several components at once. Init exactly once per page load and share
// the resulting instance across every usePush() caller.
let initPromise: Promise<OneSignalSdk | null> | null = null;

/** Persist the push *subscription* id (what the REST API targets) for the signed-in user. */
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

/** Initializes OneSignal (once) and provides push permission helpers. */
export function usePush() {
    const { user } = useAuth();
    const [initialized, setInitialized] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        ensureOneSignal()
            .then((OneSignal) => {
                if (!OneSignal || cancelled) return;
                setInitialized(true);
                setPermissionGranted(OneSignal.Notifications.permission);
            })
            .catch((e) => {
                if (!cancelled) setError(`init: ${e instanceof Error ? e.message : String(e)}`);
            });
        return () => {
            cancelled = true;
        };
    }, [user]);

    const requestPermission = useCallback(async () => {
        try {
            const OneSignal = await ensureOneSignal();
            if (!OneSignal) return false;
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
    }, []);

    return { initialized, permissionGranted, requestPermission, error };
}
