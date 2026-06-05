import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { usePush } from "@/hooks/use-push";

const DISMISSED_KEY = "courtsub_push_prompt_dismissed";

interface PushPromptProps {
    /** Contextual variant determines the message shown */
    variant: "post_created" | "post_viewed";
}

export function PushPrompt({ variant }: PushPromptProps) {
    const { permissionGranted, requestPermission } = usePush();
    const [dismissed, setDismissed] = useState(true); // default to hidden
    const [requesting, setRequesting] = useState(false);

    useEffect(() => {
        // Don't show if already granted or dismissed
        if (permissionGranted) return;
        const wasDismissed = localStorage.getItem(DISMISSED_KEY) === "true";
        setDismissed(wasDismissed);
    }, [permissionGranted]);

    const handleDismiss = useCallback(() => {
        setDismissed(true);
        localStorage.setItem(DISMISSED_KEY, "true");
    }, []);

    const handleAccept = useCallback(async () => {
        setRequesting(true);
        await requestPermission();
        setRequesting(false);
        setDismissed(true);
    }, [requestPermission]);

    // Don't render if already granted, dismissed, or not supported
    if (permissionGranted || dismissed || !("Notification" in window)) {
        return null;
    }

    const message = variant === "post_created"
        ? "Enable push notifications to know when someone claims your spot."
        : "Get notified when prices drop or new spots open at your skill level.";

    return (
        <div className="mx-4 mt-3 rounded-xl border border-brand bg-brand-section_subtle p-4">
            <p className="text-sm font-medium text-primary">{message}</p>
            <div className="mt-3 flex gap-2">
                <Button
                    color="primary"
                    size="sm"
                    onClick={handleAccept}
                    isLoading={requesting}
                    showTextWhileLoading
                >
                    Enable push
                </Button>
                <Button color="tertiary" size="sm" onClick={handleDismiss}>
                    Not now
                </Button>
            </div>
        </div>
    );
}
