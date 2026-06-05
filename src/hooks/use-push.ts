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
                await OneSignal.init({ appId: ONESIGNAL_APP_ID, allowLocalhostAsSecureOrigin: true });
                setInitialized(true);

                const permission = await OneSignal.Notifications.permission;
                setPermissionGranted(permission);

                // If already subscribed, store the player ID
                if (permission && user) {
                    const playerId = await OneSignal.User.onesignalId;
                    if (playerId) {
                        await supabase.from("users").update({ onesignal_player_id: playerId }).eq("id", user.id);
                    }
                }
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
            const permission = await OneSignal.Notifications.permission;
            setPermissionGranted(permission);

            if (permission) {
                const playerId = await OneSignal.User.onesignalId;
                if (playerId) {
                    await supabase.from("users").update({ onesignal_player_id: playerId }).eq("id", user.id);
                }
            }
            return permission;
        } catch {
            return false;
        }
    }, [initialized, user]);

    return { initialized, permissionGranted, requestPermission };
}
