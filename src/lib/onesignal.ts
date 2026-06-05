import OneSignal from "react-onesignal";

let initialized = false;

export async function initOneSignal() {
    if (initialized || !import.meta.env.VITE_ONESIGNAL_APP_ID) return;
    initialized = true;
    await OneSignal.init({
        appId: import.meta.env.VITE_ONESIGNAL_APP_ID as string,
        safari_web_id: undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notifyButton: { enable: false } as any,
        allowLocalhostAsSecureOrigin: true,
    });
}

export async function getPlayerId(): Promise<string | null> {
    const id = await OneSignal.User.PushSubscription.id;
    return id ?? null;
}
