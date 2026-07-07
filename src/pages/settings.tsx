import { useCallback, useEffect, useState } from "react";
import { Toggle } from "@/components/base/toggle/toggle";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

interface NotificationPref {
    notification_type: string;
    push_enabled: boolean;
    email_enabled: boolean;
}

const NOTIFICATION_TYPES = [
    { key: "claim_submitted", label: "New claim on your post", hint: "When someone claims a spot you posted", defaultEmail: true, defaultPush: true },
    { key: "claim_approved", label: "Claim approved", hint: "When a poster approves your claim", defaultEmail: true, defaultPush: true },
    { key: "claim_rejected", label: "Claim rejected", hint: "When a poster rejects your claim", defaultEmail: true, defaultPush: true },
    { key: "claimer_backed_out", label: "Claimer backed out", hint: "When an approved claimer withdraws from your post", defaultEmail: true, defaultPush: false },
    { key: "cost_changed", label: "Cost changed", hint: "When the cost changes on a post you claimed", defaultEmail: true, defaultPush: false },
    { key: "nudge_no_response", label: "Claim response reminder", hint: "Reminder to respond to pending claims on your posts", defaultEmail: true, defaultPush: false },
    { key: "claimer_cancelled", label: "Claimer cancelled", hint: "When a claimer cancels their pending claim on your post", defaultEmail: true, defaultPush: false },
    { key: "price_drop", label: "Price drop", hint: "When a post you viewed reduces its price", defaultEmail: true, defaultPush: false },
    { key: "spot_reopened", label: "Spot reopened", hint: "When a spot opens up on a post you're watching", defaultEmail: true, defaultPush: false },
    { key: "48h_unfilled", label: "48h unfilled nudge", hint: "Reminder when your post has been up 48 hours with no claims", defaultEmail: true, defaultPush: false },
    { key: "game_reminder", label: "Game reminder", hint: "Reminder the day before a game", defaultEmail: true, defaultPush: false },
    { key: "friend_expiry", label: "Friend's game filling up", hint: "When a friend's post is close to game time with open spots", defaultEmail: true, defaultPush: false },
    { key: "friend_new_post", label: "Friend posts new sub need", hint: "When a friend creates a new sub need post", defaultEmail: false, defaultPush: false },
] as const;

export function Settings() {
    const { user } = useAuth();
    const [prefs, setPrefs] = useState<Map<string, NotificationPref>>(new Map());
    const [loading, setLoading] = useState(true);
    const [pushSupported, setPushSupported] = useState(false);

    useEffect(() => {
        setPushSupported("Notification" in window);
    }, []);

    const fetchPrefs = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from("notification_preferences")
            .select("notification_type, push_enabled, email_enabled")
            .eq("user_id", user.id);

        const map = new Map<string, NotificationPref>();
        // Set defaults for all types
        for (const t of NOTIFICATION_TYPES) {
            map.set(t.key, { notification_type: t.key, push_enabled: t.defaultPush, email_enabled: t.defaultEmail });
        }
        // Overlay saved preferences
        if (data) {
            for (const row of data) {
                map.set(row.notification_type, row as NotificationPref);
            }
        }
        setPrefs(map);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchPrefs();
    }, [fetchPrefs]);

    const handleToggle = useCallback(async (type: string, channel: "push_enabled" | "email_enabled", value: boolean) => {
        if (!user) return;

        // Optimistic update
        setPrefs((prev) => {
            const next = new Map(prev);
            const existing = next.get(type);
            if (existing) {
                next.set(type, { ...existing, [channel]: value });
            }
            return next;
        });

        const { error } = await supabase
            .from("notification_preferences")
            .upsert(
                { user_id: user.id, notification_type: type, [channel]: value },
                { onConflict: "user_id,notification_type" },
            );

        // Revert on error
        if (error) {
            setPrefs((prev) => {
                const next = new Map(prev);
                const existing = next.get(type);
                if (existing) {
                    next.set(type, { ...existing, [channel]: !value });
                }
                return next;
            });
        }
    }, [user]);

    if (loading) {
        return (
            <AppLayout>
                <div className="flex flex-1 items-center justify-center py-16">
                    <div className="size-8 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="px-4 py-6">
                <h1 className="text-lg font-semibold text-primary">Notification preferences</h1>
                <p className="mt-1 text-sm text-tertiary">
                    Choose how you want to be notified for each event.
                </p>

                {/* Column headers */}
                <div className="mt-6 flex items-center gap-2 border-b border-secondary pb-2">
                    <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-tertiary">Notification</span>
                    <span className="w-14 text-center text-xs font-semibold uppercase tracking-wider text-tertiary">Email</span>
                    {pushSupported && (
                        <span className="w-14 text-center text-xs font-semibold uppercase tracking-wider text-tertiary">Push</span>
                    )}
                    <span className="w-14 text-center text-xs font-semibold uppercase tracking-wider text-quaternary">SMS</span>
                </div>

                <ul className="divide-y divide-secondary">
                    {NOTIFICATION_TYPES.map((type) => {
                        const pref = prefs.get(type.key);
                        return (
                            <li key={type.key} className="flex items-center gap-2 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-primary">{type.label}</p>
                                    <p className="text-xs text-tertiary">{type.hint}</p>
                                </div>
                                <div className="flex w-14 justify-center">
                                    <Toggle
                                        isSelected={pref?.email_enabled ?? type.defaultEmail}
                                        onChange={(v) => handleToggle(type.key, "email_enabled", v)}
                                        aria-label={`${type.label} email`}
                                    />
                                </div>
                                {pushSupported && (
                                    <div className="flex w-14 justify-center">
                                        <Toggle
                                            isSelected={pref?.push_enabled ?? type.defaultPush}
                                            onChange={(v) => handleToggle(type.key, "push_enabled", v)}
                                            aria-label={`${type.label} push`}
                                        />
                                    </div>
                                )}
                                <div className="flex w-14 flex-col items-center justify-center">
                                    <Toggle
                                        isSelected={false}
                                        onChange={() => {}}
                                        isDisabled
                                        aria-label={`${type.label} SMS (coming soon)`}
                                    />
                                    <span className="mt-0.5 text-[10px] text-quaternary">Soon</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </AppLayout>
    );
}
