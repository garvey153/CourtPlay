import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./use-auth";

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string;

/** Initializes OneSignal and provides push permission helpers. */
export function usePush() {
    const { user } = useAuth();
    const [initialized, setInitialized] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Initialize OneSignal SDK
    useEffect(() => {
        if (!ONESIGNAL_APP_ID || initialized) return;

        async function init() {
            try {
                const OneSignal = (await import("react-onesignal")).default;
                await OneSignal.init({
                    appId: ONESIGNAL_APP_ID,
                    allowLocalhostAsSecureOrigin: true,
                    // Our VitePWA worker owns scope "/", so OneSignal's worker runs under
                    // its own sub-scope to avoid clobbering it. File: public/push/onesignal/.
                    serviceWorkerParam: { scope: "/push/onesignal/" },
                    serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
                });
                setInitialized(true);

                // Persist the *push subscription* id — that's what the REST API targets
                // via include_player_ids. NOT User.onesignalId (a different, user-level id).
                const storeSubscriptionId = async () => {
                    const subId = OneSignal.User.PushSubscription.id;
                    if (subId && user) {
                        await supabase.from("users").update({ onesignal_player_id: subId }).eq("id", user.id);
                    }
                };

                // The id may not exist until the subscription settles, so also react to changes.
                OneSignal.User.PushSubscription.addEventListener("change", storeSubscriptionId);

                setPermissionGranted(OneSignal.Notifications.permission);
                if (OneSignal.Notifications.permission) await storeSubscriptionId();
            } catch (e) {
                console.warn("OneSignal init failed:", e);
            }
        }

        init();
    }, [initialized, user]);

    // Request push permission and store player ID
    const requestPermission = useCallback(async () => {
        if (!initialized || !user) return false;

        try {
            const OneSignal = (await import("react-onesignal")).default;
            await OneSignal.Notifications.requestPermission();
            const permission = OneSignal.Notifications.permission;
            setPermissionGranted(permission);

            if (permission) {
                const subId = OneSignal.User.PushSubscription.id;
                if (subId) {
                    await supabase.from("users").update({ onesignal_player_id: subId }).eq("id", user.id);
                }
            }
            return permission;
        } catch {
            return false;
        }
    }, [initialized, user]);

    return { initialized, permissionGranted, requestPermission };
}
