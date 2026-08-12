import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Selection } from "react-aria-components";
import { useNavigate } from "react-router";
import { XClose } from "@untitledui/icons";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { MultiSelect } from "@/components/base/select/multi-select";
import { Select } from "@/components/base/select/select";
import { SelectItem } from "@/components/base/select/select-item";
import { Toggle } from "@/components/base/toggle/toggle";
import { motion } from "motion/react";
import { AppLayout } from "@/components/layout/app-layout";
import { cx } from "@/utils/cx";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";
import { NOTIFICATION_TYPES } from "@/lib/notifications";
import { LoadingState, Spinner } from "@/components/application/loading-indicator/spinner";
import { describeActionError } from "@/utils/load-error";
import { FIELD, FIELD_SELECT } from "@/components/base/input/field-styles";
import {
    PRIMARY_MD as PRIMARY_BTN,
    SECONDARY_MD as SECONDARY_BTN,
    PRIMARY_SM as PRIMARY_ACTION,
    SECONDARY_SM as SECONDARY_ACTION,
} from "@/components/base/buttons/button-styles";

// Descriptive NTRP labels — match the create-post form's contents exactly.
const SKILL_LEVELS = [
    { id: "2.5", label: "NTRP 2.5 (Advanced Beginner)" },
    { id: "3.0", label: "NTRP 3.0 (Lower-Intermediate)" },
    { id: "3.5", label: "NTRP 3.5 (Intermediate)" },
    { id: "4.0", label: "NTRP 4.0 (Intermediate-Advanced)" },
    { id: "4.5", label: "NTRP 4.5 (Advanced)" },
    { id: "5.0", label: "NTRP 5.0 to 7.0 (Pro)" },
];




interface Court {
    id: string;
    name: string;
    area: string | null;
}

interface NotifPref {
    email: boolean;
    push: boolean;
}

/** The editable slice of the profile — used for dirty tracking. */
interface FormState {
    skill_level: string;
    court_preferences: Selection;
    new_to_westport: boolean;
    feed_connected_only: boolean;
    phone: string;
    venmo_handle: string;
    photo_url: string;
}

/**
 * Serialize the editable state so we can cheaply compare against the loaded
 * snapshot. Covers BOTH tabs: Save commits the whole screen, so an edit on
 * either tab has to enable it.
 */
function serialize(form: FormState, prefs: Map<string, NotifPref>): string {
    const courts = form.court_preferences instanceof Set ? [...(form.court_preferences as Set<string>)].sort() : [];
    const notif = NOTIFICATION_TYPES.map((t) => {
        const p = prefs.get(t.key);
        return `${t.key}:${p?.email ? 1 : 0}${p?.push ? 1 : 0}`;
    }).join(",");
    return JSON.stringify({
        skill: form.skill_level,
        courts,
        moved: form.new_to_westport,
        feedConnected: form.feed_connected_only,
        phone: form.phone.trim(),
        venmo: form.venmo_handle.trim(),
        photo: form.photo_url,
        notif,
    });
}

/** Read-only field (First name / Last name / Email) — matches the design's bordered box. */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-secondary">
                {label} <span aria-hidden="true">*</span>
            </span>
            <div className="flex h-9 items-center rounded-lg border border-neutral-600 px-3 shadow-xs">
                <span className="truncate text-sm text-tertiary">{value}</span>
            </div>
        </div>
    );
}

export function EditProfile() {
    const { user } = useAuth();
    const { profile, refreshProfile } = useProfile();
    // Admin-only notification rows (e.g. feedback alerts) are hidden from players.
    const visibleNotificationTypes = NOTIFICATION_TYPES.filter(
        (t) => profile?.is_admin || !("adminOnly" in t && t.adminOnly),
    );
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDiscard, setShowDiscard] = useState(false);
    const [courts, setCourts] = useState<Court[]>([]);

    // Read-only identity fields.
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");

    // Editable fields.
    const [form, setForm] = useState<FormState>({
        skill_level: "",
        court_preferences: new Set<string>(),
        new_to_westport: false,
        feed_connected_only: false,
        phone: "",
        venmo_handle: "",
        photo_url: "",
    });
    const [prefs, setPrefs] = useState<Map<string, NotifPref>>(new Map());

    // "Use my location" is a browser-geolocation opt-in only — not persisted.
    const [useLocation, setUseLocation] = useState(false);

    // Snapshot of the loaded state; the form is dirty once it diverges.
    const snapshot = useRef<string>("");

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

    // ── Load ────────────────────────────────────────────────────────────────
    useEffect(() => {
        supabase
            .from("courts")
            .select("id, name, area")
            .eq("active", true)
            .order("name")
            .then(({ data }) => setCourts(data ?? []));
    }, []);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;

        (async () => {
            const { data: row } = await supabase
                .from("users")
                .select("first_name, last_name, email, skill_level, court_preferences, new_to_westport, phone, venmo_handle, photo_url, feed_connected_only")
                .eq("id", user.id)
                .single();

            // Sensitive fields are stored encrypted — decrypt to prefill.
            let phone = "";
            let venmo = "";
            if (row?.phone) {
                const { data } = await supabase.rpc("decrypt_sensitive", { p_value: row.phone });
                phone = (data as string) ?? "";
            }
            if (row?.venmo_handle) {
                const { data } = await supabase.rpc("decrypt_sensitive", { p_value: row.venmo_handle });
                venmo = (data as string) ?? "";
            }

            const { data: prefRows } = await supabase
                .from("notification_preferences")
                .select("notification_type, push_enabled, email_enabled")
                .eq("user_id", user.id);

            if (cancelled) return;

            setFirstName(row?.first_name ?? "");
            setLastName(row?.last_name ?? "");
            setEmail(row?.email ?? user.email ?? "");

            const nextForm: FormState = {
                skill_level: row?.skill_level ?? "",
                court_preferences: new Set<string>(row?.court_preferences ?? []),
                new_to_westport: row?.new_to_westport ?? false,
                feed_connected_only: row?.feed_connected_only ?? false,
                phone,
                venmo_handle: venmo,
                photo_url: row?.photo_url ?? "",
            };

            const map = new Map<string, NotifPref>();
            for (const t of NOTIFICATION_TYPES) map.set(t.key, { email: t.defaultEmail, push: t.defaultPush });
            for (const r of prefRows ?? []) {
                map.set(r.notification_type, { email: r.email_enabled, push: r.push_enabled });
            }

            setForm(nextForm);
            setPrefs(map);
            snapshot.current = serialize(nextForm, map);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
        // Key on the stable user id — `user` is a fresh object each render, and
        // re-running the load would clobber in-progress edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Which pane is showing. Both panes are one form and one dirty check — the
    // tabs split the fields for reading, not into separate saves, so Save
    // changes commits whatever was edited on either.
    const [tab, setTab] = useState<"profile" | "notifications" | "feed">("profile");

    const dirty = useMemo(() => !loading && serialize(form, prefs) !== snapshot.current, [loading, form, prefs]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const backToProfile = useCallback(() => navigate("/profile/me"), [navigate]);

    const handleCancel = useCallback(() => {
        if (dirty) setShowDiscard(true);
        else backToProfile();
    }, [dirty, backToProfile]);

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        const ext = file.name.split(".").pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
        if (!upErr) {
            const { data } = supabase.storage.from("avatars").getPublicUrl(path);
            // Cache-bust so the new image shows immediately (same path, upsert).
            set("photo_url", `${data.publicUrl}?t=${file.size}`);
        }
    };

    const toggleUseLocation = (v: boolean) => {
        setUseLocation(v);
        // Opt-in requests browser geolocation permission; nothing is persisted.
        if (v && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                () => {},
                () => setUseLocation(false),
            );
        }
    };

    const setNotif = (key: string, channel: keyof NotifPref, value: boolean) => {
        setPrefs((prev) => {
            const next = new Map(prev);
            const existing = next.get(key) ?? { email: false, push: false };
            next.set(key, { ...existing, [channel]: value });
            return next;
        });
    };

    /**
     * Saves the whole screen, both tabs, in one go: the users row and every
     * notification preference. The tabs divide the form for reading, not into
     * separate saves, so which tab is showing does not change what is written.
     */
    const handleSave = async () => {
        if (!user || !dirty || saving) return;
        setSaving(true);
        setError(null);
        try {

            // Re-encrypt sensitive fields before writing.
            let encryptedPhone: string | null = null;
            let encryptedVenmo: string | null = null;
            if (form.phone.trim()) {
                const { data } = await supabase.rpc("encrypt_sensitive", { p_value: form.phone.trim() });
                encryptedPhone = data as string;
            }
            if (form.venmo_handle.trim()) {
                const { data } = await supabase.rpc("encrypt_sensitive", { p_value: form.venmo_handle.trim() });
                encryptedVenmo = data as string;
            }

            const courtPrefs = form.court_preferences instanceof Set ? [...(form.court_preferences as Set<string>)] : [];

            const { error: upErr } = await supabase
                .from("users")
                .update({
                    skill_level: form.skill_level || null,
                    court_preferences: courtPrefs.length > 0 ? courtPrefs : null,
                    new_to_westport: form.new_to_westport,
                    feed_connected_only: form.feed_connected_only,
                    phone: encryptedPhone,
                    venmo_handle: encryptedVenmo,
                    photo_url: form.photo_url || null,
                })
                .eq("id", user.id);
            if (upErr) throw upErr;

            const { error: prefErr } = await supabase.from("notification_preferences").upsert(
                visibleNotificationTypes.map((t) => {
                    const p = prefs.get(t.key);
                    return {
                        user_id: user.id,
                        notification_type: t.key,
                        email_enabled: p?.email ?? t.defaultEmail,
                        push_enabled: p?.push ?? t.defaultPush,
                    };
                }),
                { onConflict: "user_id,notification_type" },
            );
            if (prefErr) throw prefErr;

            // Refresh the global profile cache so skill level, courts, photo, etc.
            // update everywhere that reads it (post creation, feed, activity, route
            // guard) — not just on the profile page's own refetch.
            await refreshProfile();
            backToProfile();
        } catch (e) {
            console.error("save profile failed:", e);
            setError(describeActionError(e, "save your changes"));
            setSaving(false);
        }
    };

    const courtItems = courts.map((c) => ({ id: c.id, label: c.name, supportingText: c.area ?? undefined }));

    return (
        <AppLayout>
            {/* Full-page modal, the same shell as Create/Edit group
                (group-form-sheet.tsx): pinned header with a close button, one
                scrolling body, pinned actions. The inset-top padding sits on this
                container rather than the header, because the close button is
                absolutely positioned against the header's border box — padding the
                header alone would push the title down and leave the button under
                the status bar. */}
            <div
                className="fixed inset-0 z-50 flex justify-center"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-profile-title"
            >
                <div className="flex w-full max-w-lg flex-col overflow-hidden bg-secondary pt-[env(safe-area-inset-top)] shadow-xl">
                    <div className="relative shrink-0 px-5 pt-[18px] pb-6">
                        <h1 id="edit-profile-title" className="pr-9 text-lg font-semibold text-primary">
                            Settings
                        </h1>
                        {/* Closing is Cancel, so unsaved edits still prompt. */}
                        <button
                            type="button"
                            onClick={handleCancel}
                            aria-label="Close"
                            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-tertiary transition duration-100 ease-linear hover:text-secondary"
                        >
                            <XClose className="size-5" />
                        </button>
                    </div>

            {loading ? (
                <LoadingState variant="fill" label="Loading your profile" />
            ) : (
                <>
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6">
                    {/* Pill tabs, the same shape Activity uses. Above the avatar, per
                        the design (Figma 628:9553), and inside the scrolling body so
                        both scroll away together — only the header and the action bar
                        hold position. */}
                    <div className="flex gap-2">
                        {(
                            [
                                { id: "profile", label: "Profile" },
                                { id: "notifications", label: "Notifications" },
                                { id: "feed", label: "Feed" },
                            ] as const
                        ).map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                aria-pressed={tab === t.id}
                                className={cx(
                                    "rounded-full px-3.5 py-1 text-xs font-semibold transition duration-100 ease-linear",
                                    tab === t.id ? "bg-brand-500 text-neutral-950" : "bg-tertiary text-secondary hover:text-primary",
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Avatar + change photo. The name moved to the header, so this
                        row is the photo control rather than a page title. */}
                    <div className="flex items-center gap-3">
                        <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full border border-secondary_alt bg-white p-[3px] shadow-xs">
                            {form.photo_url ? (
                                <img src={form.photo_url} alt="" referrerPolicy="no-referrer" className="size-full rounded-full object-cover" />
                            ) : (
                                <div className="flex size-full items-center justify-center rounded-full bg-tertiary text-2xl font-semibold text-secondary">
                                    {firstName.charAt(0).toUpperCase() || "?"}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-md font-semibold text-primary">Profile photo</p>
                            <label className="mt-0.5 inline-block cursor-pointer text-sm font-medium text-brand-500 hover:text-brand-600">
                                Change photo
                                <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
                            </label>
                        </div>
                    </div>

                {tab === "profile" ? (
                <>

                    {/* Personal info */}
                    <section className="flex flex-col gap-6">
                        <h2 className="text-md font-semibold text-primary">Personal info</h2>
                        <ReadOnlyField label="First name" value={firstName} />
                        <ReadOnlyField label="Last name" value={lastName} />
                        <ReadOnlyField label="Email" value={email} />
                        <Select
                            label="Skill level"
                            placeholder="Select your level"
                            isNonModal
                            size="sm"
                            items={SKILL_LEVELS}
                            selectedKey={form.skill_level || null}
                            onSelectionChange={(k) => set("skill_level", (k as string) ?? "")}
                            triggerClassName={FIELD_SELECT}
                            isRequired
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>
                        <MultiSelect
                            label="Preferred locations"
                            placeholder="Select courts"
                            size="sm"
                            isNonModal
                            showSearch={false}
                            showFooter={false}
                            items={courtItems}
                            emptyStateTitle="No courts on the books"
                            emptyStateDescription="They'll show up here once someone adds them."
                            emptyStateHideIcon
                            emptyStateAlign="left"
                            selectedKeys={form.court_preferences}
                            onSelectionChange={(keys) => set("court_preferences", keys)}
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => (
                                <SelectItem
                                    id={item.id}
                                    supportingText={item.supportingText}
                                    selectionIndicator="checkbox"
                                    selectionIndicatorAlign="left"
                                >
                                    {item.label}
                                </SelectItem>
                            )}
                        </MultiSelect>
                        <Checkbox label="Use my location" isSelected={useLocation} onChange={toggleUseLocation} />
                        <Checkbox
                            label="I've recently moved to this location"
                            isSelected={form.new_to_westport}
                            onChange={(v) => set("new_to_westport", v)}
                        />
                    </section>

                    {/* Contact & Payment */}
                    <section className="flex flex-col gap-6">
                        <h2 className="text-md font-semibold text-primary">Contact &amp; Payment</h2>
                        <Input
                            label="Phone number"
                            type="tel"
                            size="sm"
                            wrapperClassName={FIELD}
                            placeholder="+1 (203) 555-0100"
                            value={form.phone}
                            onChange={(v) => set("phone", v)}
                            hint="Encrypted and only visible after a claim is approved."
                        />
                        <Input
                            label="Venmo handle"
                            size="sm"
                            wrapperClassName={FIELD}
                            placeholder="@yourhandle"
                            value={form.venmo_handle}
                            onChange={(v) => set("venmo_handle", v)}
                            hint="Used to generate payment requests. Encrypted and only visible after approval."
                        />
                    </section>

                </>
                ) : tab === "feed" ? (
                <>
                    {/* Feed */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-md font-semibold text-primary">Feed</h2>
                        <Checkbox
                            label="Only show posts from my groups and players I'm following."
                            isSelected={form.feed_connected_only}
                            onChange={(v) => set("feed_connected_only", v)}
                        />
                    </section>
                </>
                ) : (
                <>
                    {/* Notifications */}
                    <section className="flex flex-col gap-4">
                        <div>
                            <h2 className="text-md font-semibold text-primary">Notifications</h2>
                            <p className="mt-1 text-sm text-tertiary">
                                Choose how you want to hear about claims, matches, and price drops.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 border-b border-secondary pb-2">
                            <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-tertiary">Notification</span>
                            <span className="w-12 text-center text-xs font-semibold uppercase tracking-wider text-tertiary">Email</span>
                            <span className="w-12 text-center text-xs font-semibold uppercase tracking-wider text-tertiary">Push</span>
                        </div>

                        <ul className="-mt-2 divide-y divide-secondary">
                            {visibleNotificationTypes.map((t) => {
                                const p = prefs.get(t.key);
                                return (
                                    <li key={t.key} className="flex items-center gap-2 py-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-primary">{t.label}</p>
                                            <p className="text-xs text-tertiary">{t.hint}</p>
                                        </div>
                                        <div className="flex w-12 justify-center">
                                            <Toggle
                                                isSelected={p?.email ?? t.defaultEmail}
                                                onChange={(v) => setNotif(t.key, "email", v)}
                                                aria-label={`${t.label} email`}
                                            />
                                        </div>
                                        <div className="flex w-12 justify-center">
                                            <Toggle
                                                isSelected={p?.push ?? t.defaultPush}
                                                onChange={(v) => setNotif(t.key, "push", v)}
                                                aria-label={`${t.label} push`}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </>
                )}
                </div>

                {/* Pinned to the bottom of the screen: a shrink-0 sibling of the
                    scrolling body, so it stays put however far the form scrolls and
                    on whichever tab. Its padding carries the home-indicator inset,
                    since it is the last thing on screen — which is also why the
                    body above went back to a plain pb-6.

                    Cancel left, Save right, the arrangement this screen had before,
                    rather than the stacked pair the group form uses. */}
                <div className="shrink-0 px-5 pt-4 pb-8">
                    {error && <p className="mb-3 text-sm text-error-primary">{error}</p>}
                    <div className="flex items-center justify-between gap-3">
                        <button type="button" onClick={handleCancel} disabled={saving} className={SECONDARY_ACTION}>
                            Cancel
                        </button>
                        <button type="button" onClick={handleSave} disabled={!dirty || saving} className={PRIMARY_ACTION}>
                            {saving ? <Spinner size="sm" tone="on-brand" /> : "Save changes"}
                        </button>
                    </div>
                </div>
                </>
            )}
                </div>
            </div>

            {/* Discard-changes confirmation — the bottom sheet the delete confirms
                use (admin-group-delete-sheet.tsx, created-detail-sheet.tsx):
                heading, one line of consequence, then the destructive choice over
                the safe one.

                z-[60] sits it ABOVE the settings form's z-50 so the form stays
                visible behind rather than being replaced. Equal z-indexes would
                leave that to DOM order, which breaks the moment the two move. */}
            {showDiscard && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center backdrop-blur-[8px] sm:items-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="discard-changes-title"
                >
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowDiscard(false)} aria-hidden="true" />

                    <motion.div
                        className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        transition={{ type: "spring", damping: 38, stiffness: 420 }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h2 id="discard-changes-title" className="min-w-0 text-md font-semibold text-primary">
                                Discard changes?
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowDiscard(false)}
                                aria-label="Close"
                                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                            >
                                <XClose className="size-5" strokeWidth={1} />
                            </button>
                        </div>

                        <p className="text-sm text-secondary">
                            You have unsaved changes. Leaving now will discard them.
                        </p>

                        <div className="mt-2 flex flex-col gap-3">
                            <button type="button" onClick={backToProfile} className={PRIMARY_BTN}>
                                Yes, discard
                            </button>
                            <button type="button" onClick={() => setShowDiscard(false)} className={SECONDARY_BTN}>
                                No, keep editing
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AppLayout>
    );
}
