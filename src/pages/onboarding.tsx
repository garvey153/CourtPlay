import { useEffect, useRef, useState } from "react";
import { Checkbox as AriaCheckbox, type Selection } from "react-aria-components";
import { useNavigate } from "react-router";
import { ArrowLeft, Check } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { SearchField } from "@/components/base/input/search-field";
import { MultiSelect } from "@/components/base/select/multi-select";
import { Select } from "@/components/base/select/select";
import { SelectItem } from "@/components/base/select/select-item";
import { Toggle } from "@/components/base/toggle/toggle";
import { AvatarCropper } from "@/components/app/avatar-cropper";
import { useAvatarUpload } from "@/hooks/use-avatar-upload";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { SEEDED_NOTIFICATION_TYPES } from "@/lib/notifications";
import { sendInvite } from "@/lib/invite";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { menuWidth } from "@/utils/menu-width";
import { skillLabel } from "@/utils/skill-label";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { describeActionError } from "@/utils/load-error";
import { FIELD_AUTOFILL, FIELD_SELECT } from "@/components/base/input/field-styles";
import { PRIMARY_SM_GAP1_5 as PRIMARY_BTN, SECONDARY_SM_GAP1 as SECONDARY_BTN } from "@/components/base/buttons/button-styles";

// Matches the Profile page's follow rows: "First L." plus the skill label.
function rowName(first: string, last: string, level: string | null): string {
    const name = last ? `${first} ${last.charAt(0)}.` : first;
    const skill = skillLabel(level);
    return skill ? `${name} · ${skill}` : name;
}

const SKILL_LEVELS = [
    { id: "2.5", label: "2.5 — Beginner" },
    { id: "3.0", label: "3.0 — Beginner+" },
    { id: "3.5", label: "3.5 — Intermediate" },
    { id: "4.0", label: "4.0 — Intermediate+" },
    { id: "4.5", label: "4.5 — Advanced" },
    { id: "5.0", label: "5.0 — Expert" },
];


interface FormData {
    first_name: string;
    last_name: string;
    skill_level: string;
    tos_accepted: boolean;
    photo_file: File | null;
    photo_url: string;
    court_preferences: Selection;
    pro_preference: string;
    phone: string;
    venmo_handle: string;
    push_enabled: boolean;
    email_enabled: boolean;
}

interface Court {
    id: string;
    name: string;
    area: string | null;
}

interface MemberResult {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    skill_level: string | null;
    headline: string | null;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function Onboarding() {
    const { user } = useAuth();
    const { setProfile } = useProfile();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [courts, setCourts] = useState<Court[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 5 — member search & invite
    const [step5View, setStep5View] = useState<"search" | "invite">("search");
    const [memberQuery, setMemberQuery] = useState("");
    const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
    // The actual member objects followed (from search OR the recent list), so the
    // "Following" list renders regardless of source or the current search query.
    const [followedMembers, setFollowedMembers] = useState<MemberResult[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteConfirmEmail, setInviteConfirmEmail] = useState<string | null>(null);
    const [suggestedFollows, setSuggestedFollows] = useState<MemberResult[]>([]);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState<FormData>({
        first_name: "",
        last_name: "",
        skill_level: "",
        tos_accepted: false,
        photo_file: null,
        photo_url: "",
        court_preferences: new Set<string>(),
        pro_preference: "",
        phone: "",
        venmo_handle: "",
        push_enabled: false,
        email_enabled: true,
    });

    const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    // Pre-populate from Google OAuth metadata
    useEffect(() => {
        if (!user) return;
        const meta = user.user_metadata;
        // Supabase stores Google photo in user_metadata, but also check identities as fallback
        const identityMeta = user.identities?.find((i) => i.provider === "google")?.identity_data;
        const photoUrl =
            meta?.avatar_url ||
            meta?.picture ||
            identityMeta?.avatar_url ||
            identityMeta?.picture ||
            "";
        const fullName: string = meta?.full_name || meta?.name || identityMeta?.full_name || identityMeta?.name || "";
        const parts = fullName.trim().split(" ");
        setForm((f) => ({
            ...f,
            first_name: f.first_name || parts[0] || "",
            last_name: f.last_name || (parts.length > 1 ? parts.slice(1).join(" ") : "") || "",
            photo_url: f.photo_url || photoUrl,
        }));
    }, [user]);

    useEffect(() => {
        supabase
            .from("courts")
            .select("id, name, area")
            .eq("active", true)
            .order("name")
            .then(({ data }) => setCourts(data ?? []));
    }, []);


    const {
        cropping,
        busy: photoBusy,
        error: photoError,
        pick: handlePhotoChange,
        upload: uploadAvatar,
        cancel: cancelCrop,
    } = useAvatarUpload(user?.id, (url, blob) => {
        set("photo_url", url);
        // The cropped square, not what came out of the picker.
        set("photo_file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    });

    // Close search dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Debounced member search
    useEffect(() => {
        if (memberQuery.trim().length < 2 || !user) {
            setMemberResults([]);
            setShowDropdown(false);
            return;
        }
        setSearchLoading(true);
        const t = setTimeout(async () => {
            // Via RPC, not a direct table read: public.users is own-row only now,
            // so the browser can't search other players itself. search_users is
            // security definer and returns just the public-facing fields.
            const { data } = await supabase.rpc("search_users", {
                p_query: memberQuery.trim(),
                p_limit: 8,
            });
            setMemberResults((data as MemberResult[]) ?? []);
            setShowDropdown(true);
            setSearchLoading(false);
        }, 300);
        return () => clearTimeout(t);
    }, [memberQuery, user]);

    // Suggest the 5 most recently joined players when entering the invite step.
    useEffect(() => {
        if (step !== 3 || !user) return;
        // Same reason as the search above — the self/deleted/suspended filtering
        // and the ordering now live in the RPC. Named get_recent_players rather
        // than get_suggested_follows: that name was already taken by a function
        // returning mutual-follow/shared-court suggestions, which can be empty
        // for a brand-new account and would leave this step blank.
        supabase.rpc("get_recent_players", { p_limit: 5 }).then(({ data }) => {
            if (data) setSuggestedFollows(data as MemberResult[]);
        });
    }, [step, user]);

    const handleFollow = async (member: MemberResult) => {
        if (!user || followedIds.has(member.id)) return;
        await supabase.from("follows").insert({ follower_id: user.id, following_id: member.id });
        setFollowedIds((prev) => new Set([...prev, member.id]));
        setFollowedMembers((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]));
    };

    const handleUnfollow = async (memberId: string) => {
        if (!user) return;
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", memberId);
        setFollowedIds((prev) => {
            const next = new Set(prev);
            next.delete(memberId);
            return next;
        });
        setFollowedMembers((prev) => prev.filter((m) => m.id !== memberId));
    };

    const handleSendInvite = async () => {
        if (!user || !isValidEmail(inviteEmail)) return;
        setInviteSending(true);
        try {
            // The row and the email are both written server-side now. This used
            // to insert the row here — which failed a foreign key, because the
            // profile does not exist until the end of onboarding — and then
            // invoke a function that had never been deployed, reporting success
            // either way.
            const result = await sendInvite(inviteEmail);
            if (!result.ok) {
                setInviteError(result.message);
                return;
            }
            setInviteError(null);
            setInviteConfirmEmail(inviteEmail.trim());
            setStep5View("search");
            setInviteEmail("");
        } finally {
            setInviteSending(false);
        }
    };

    const canProceed = (): boolean => {
        if (step === 1) {
            return (
                form.first_name.trim().length > 0 &&
                form.last_name.trim().length > 0 &&
                form.skill_level.length > 0 &&
                form.tos_accepted
            );
        }
        return true;
    };

    // Backstop for anyone who reaches /onboarding with a session that did not come
    // through auth-callback or the password path — a bookmark, a back button, a
    // stale tab. Fails open, like the others; the trigger is the real gate.
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        supabase.rpc("am_i_invited").then(({ data, error }) => {
            if (!cancelled && !error && data === false) {
                navigate("/invite-only", { replace: true, state: { email: user.email } });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [user, navigate]);

    const handleFinish = async () => {
        if (!user) return;
        setSaving(true);
        setError(null);
        try {
            // Encrypt phone and venmo via server-side RPC
            let encryptedPhone: string | null = null;
            let encryptedVenmo: string | null = null;

            if (form.phone.trim()) {
                const { data } = await supabase.rpc("encrypt_sensitive", { p_value: form.phone.trim() });
                encryptedPhone = data;
            }
            if (form.venmo_handle.trim()) {
                const { data } = await supabase.rpc("encrypt_sensitive", { p_value: form.venmo_handle.trim() });
                encryptedVenmo = data;
            }

            const courtPrefs = form.court_preferences instanceof Set
                ? [...form.court_preferences as Set<string>]
                : [];

            const { data: savedUser, error: insertError } = await supabase.from("users").upsert({
                id: user.id,
                email: user.email!,
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                skill_level: form.skill_level || null,
                photo_url: form.photo_url || null,
                court_preferences: courtPrefs.length > 0 ? courtPrefs : null,
                pro_preference: form.pro_preference.trim() || null,
                phone: encryptedPhone,
                venmo_handle: encryptedVenmo,
            }).select();

            if (insertError) throw insertError;
            if (!savedUser || savedUser.length === 0) throw new Error("Profile was not saved — upsert returned no rows. Check RLS policies.");
            // Set profile in global context so ProtectedRoute sees it immediately
            setProfile(savedUser[0]);

            // Insert notification preferences
            await supabase.from("notification_preferences").upsert(
                SEEDED_NOTIFICATION_TYPES.map((type) => ({
                    user_id: user.id,
                    notification_type: type,
                    push_enabled: form.push_enabled,
                    email_enabled: form.email_enabled,
                })),
                { onConflict: "user_id,notification_type" },
            );

            // The tutorial comes next, and it consumes cs_auth_redirect rather
            // than us — leaving the key in place is what lets a shared post link
            // survive the tutorial instead of being dropped here.
            navigate("/tutorial", { replace: true });
        } catch (e) {
            console.error("handleFinish error:", e);
            setError(describeActionError(e, "set up your profile"));
        } finally {
            setSaving(false);
        }
    };

    const courtItems = courts.map((c) => ({ id: c.id, label: c.name, supportingText: c.area ?? undefined }));

    return (
        <div className="flex min-h-dvh flex-col bg-secondary">
            {/* Progress bar */}
            <div className="flex gap-1 px-4 pt-[calc(env(safe-area-inset-top)_+_1.5rem)]">
                {[1, 2, 3].map((s) => (
                    <div
                        key={s}
                        className={`h-1 flex-1 rounded-pill transition-colors ${s <= step ? "bg-brand-solid" : "bg-tertiary"}`}
                    />
                ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6">
                {/* Step 1: Required profile fields */}
                {step === 1 && (
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center gap-4">
                            {/* Design-system "Avatar profile photo" — matches the Profile tab (see profile.tsx):
                                72px circle with a 3px white ring + subtle border around the photo. */}
                            <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full border border-secondary_alt bg-white p-[3px] shadow-xs">
                                {form.photo_url ? (
                                    <img
                                        src={form.photo_url}
                                        alt="Profile photo"
                                        referrerPolicy="no-referrer"
                                        className="size-full rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center rounded-full bg-tertiary text-2xl font-semibold text-secondary">
                                        {form.first_name.charAt(0).toUpperCase() || "?"}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-primary">Create your profile</h1>
<label
                                    className={`mt-1.5 inline-block text-sm font-semibold text-brand-secondary hover:text-brand-secondary_hover ${
                                        photoBusy ? "pointer-events-none opacity-50" : "cursor-pointer"
                                    }`}
                                >
                                    {photoBusy ? "Uploading…" : form.photo_url ? "Change photo" : "Upload photo"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={photoBusy}
                                        onChange={handlePhotoChange}
                                    />
                                </label>
                                {photoError && <p className="mt-1 text-sm text-error-primary">{photoError}</p>}
                            </div>
                        </div>
                        <Input
                            label="First name"
                            placeholder="Jane"
                            value={form.first_name}
                            onChange={(v) => set("first_name", v)}
                            isRequired
                            size="sm"
                            wrapperClassName={FIELD_AUTOFILL}
                        />
                        <Input
                            label="Last name"
                            placeholder="Doe"
                            value={form.last_name}
                            onChange={(v) => set("last_name", v)}
                            isRequired
                            size="sm"
                            wrapperClassName={FIELD_AUTOFILL}
                        />
                        <Select
                            label="Skill level (NTRP)"
                            placeholder="Select your level"
                            items={SKILL_LEVELS}
                            triggerStyle={menuWidth(SKILL_LEVELS, "Select your level")}
                            selectedKey={form.skill_level || null}
                            onSelectionChange={(k) => set("skill_level", k as string)}
                            isRequired
                            isNonModal
                            size="sm"
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>
                        <Input
                            label="Phone number"
                            type="tel"
                            placeholder="+1 (203) 555-0100"
                            value={form.phone}
                            onChange={(v) => set("phone", v)}
                            hint="Encrypted and only visible after a claim is approved."
                            size="sm"
                            wrapperClassName={FIELD_AUTOFILL}
                            className="mt-4"
                        />
                        <Input
                            label="Venmo handle (optional)"
                            placeholder="@yourhandle"
                            value={form.venmo_handle}
                            onChange={(v) => set("venmo_handle", v)}
                            hint="Used to generate payment requests. Encrypted and only visible after approval."
                            size="sm"
                            wrapperClassName={FIELD_AUTOFILL}
                        />
                        <MultiSelect
                            label="Preferred courts (optional)"
                            placeholder="Any court"
                            items={courtItems}
                            selectedKeys={form.court_preferences}
                            onSelectionChange={(keys) => set("court_preferences", keys)}
                            size="sm"
                            showSearch={false}
                            showFooter={false}
                            isNonModal
                            triggerClassName={FIELD_SELECT}
                            emptyStateTitle="No courts on the books"
                            emptyStateDescription="They'll show up here once someone adds them."
                            emptyStateHideIcon
                            emptyStateAlign="left"
                            className="mt-4"
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
                        <Input
                            label="Preferred pro / instructor (optional)"
                            placeholder="e.g. Mike at Longshore"
                            value={form.pro_preference}
                            onChange={(v) => set("pro_preference", v)}
                            size="sm"
                            wrapperClassName={FIELD_AUTOFILL}
                        />
                        {/* Checkbox styled to match the feed filter sheet's CheckRow (see feed-filters.tsx). */}
                        <AriaCheckbox
                            isSelected={form.tos_accepted}
                            onChange={(v) => set("tos_accepted", v)}
                            className="mt-4 flex items-start gap-2"
                        >
                            {({ isSelected }) => (
                                <>
                                    <span
                                        className={cx(
                                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded",
                                            isSelected ? "bg-brand-500" : "border border-neutral-200",
                                        )}
                                    >
                                        {isSelected && <Check className="size-3 text-white" strokeWidth={3} aria-hidden="true" />}
                                    </span>
                                    <span className="text-sm text-secondary">
                                        I agree to the{" "}
                                        <a href="/terms" target="_blank" className="text-brand-secondary underline">Terms of Service</a>
                                        {" "}and{" "}
                                        <a href="/privacy" target="_blank" className="text-brand-secondary underline">Privacy Policy</a>
                                    </span>
                                </>
                            )}
                        </AriaCheckbox>
                    </div>
                )}

                {/* Step 2: Notification preferences */}
                {step === 2 && (
                    <div className="flex flex-col gap-5">
                        <div>
                            <h1 className="text-xl font-semibold text-primary">Notifications</h1>
                            <p className="mt-1 text-sm text-tertiary">Choose how you want to hear about claims, matches, and price drops.</p>
                        </div>
                        <div className="flex flex-col gap-4 rounded-lg border border-secondary p-4">
                            <Toggle
                                size="sm"
                                label="Email notifications"
                                hint="Claim updates, price drops, game reminders"
                                isSelected={form.email_enabled}
                                onChange={(v) => set("email_enabled", v)}
                            />
                            <hr className="border-secondary" />
                            <Toggle
                                size="sm"
                                label="Push notifications"
                                hint="Real-time alerts on your device (requires install)"
                                isSelected={form.push_enabled}
                                onChange={(v) => set("push_enabled", v)}
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Invite players */}
                {step === 3 && (
                    <div className="flex flex-col gap-5">
                        {step5View === "invite" ? (
                            /* ── Invite sub-view ── */
                            <>
                                <button
                                    type="button"
                                    onClick={() => setStep5View("search")}
                                    className={cx(SECONDARY_BTN, "self-start")}
                                >
                                    <ArrowLeft className="size-4" aria-hidden="true" />
                                    Back to search
                                </button>
                                <div>
                                    <h1 className="text-xl font-semibold text-primary">Invite a player</h1>
                                    <p className="mt-1 text-sm text-tertiary">Send an invite to someone who isn't on CourtPlay yet.</p>
                                </div>
                                <Input
                                    label="Email address"
                                    type="email"
                                    placeholder="jane@example.com"
                                    value={inviteEmail}
                                    onChange={(v) => setInviteEmail(v)}
                                    isRequired
                                    size="sm"
                                    wrapperClassName={FIELD_AUTOFILL}
                                />
                                {inviteError && <p className="text-sm text-error-primary">{inviteError}</p>}
                                <Button
                                    color="primary"
                                    size="md"
                                    isDisabled={!isValidEmail(inviteEmail)}
                                    isLoading={inviteSending}
                                    showTextWhileLoading
                                    onClick={handleSendInvite}
                                >
                                    Send invite
                                </Button>
                            </>
                        ) : (
                            /* ── Search view ── */
                            <>
                                <div>
                                    <h1 className="text-xl font-semibold text-primary">Find your tennis crew</h1>
                                    <p className="mt-1 text-sm text-tertiary">Follow players you know so you see their posts first.</p>
                                </div>

                                {/* Invite confirmation banner */}
                                {inviteConfirmEmail && (
                                    <div className="flex items-center gap-2 rounded-lg bg-success-secondary px-3 py-2.5">
                                        <Check className="size-4 shrink-0 text-success-primary" aria-hidden="true" />
                                        <p className="text-sm text-success-primary">
                                            Invite sent to <span className="font-medium">{inviteConfirmEmail}</span>
                                        </p>
                                    </div>
                                )}

                                {/* Typeahead search */}
                                <div className="relative" ref={searchContainerRef}>
                                    {/* Filled: the onboarding page is bg-secondary. The `relative`
                                        wrapper and its ref stay OUTSIDE the field — the
                                        outside-click handler reads that element to dismiss
                                        the overlay below. */}
                                    <SearchField
                                        variant="filled"
                                        value={memberQuery}
                                        onChange={setMemberQuery}
                                        placeholder="Search by name…"
                                        onFocus={() => memberQuery.trim().length >= 2 && setShowDropdown(true)}
                                    />

                                    {/* Results overlay */}
                                    {showDropdown && (
                                        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-secondary bg-primary shadow-lg">
                                            {searchLoading ? (
                                                <p className="px-4 py-3 text-sm text-tertiary">Searching…</p>
                                            ) : memberResults.length === 0 ? (
                                                <p className="px-4 py-3 text-sm text-tertiary">No players found</p>
                                            ) : (
                                                <ul>
                                                    {memberResults.map((member) => (
                                                        <li key={member.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary">
                                                            {member.photo_url ? (
                                                                <img
                                                                    src={member.photo_url}
                                                                    alt=""
                                                                    referrerPolicy="no-referrer"
                                                                    className="size-8 shrink-0 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary text-sm font-medium text-secondary">
                                                                    {member.first_name.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-medium text-primary">
                                                                    {member.first_name} {member.last_name}
                                                                </p>
                                                                {member.skill_level && (
                                                                    <p className="text-xs text-tertiary">{member.skill_level} NTRP</p>
                                                                )}
                                                            </div>
                                                            {followedIds.has(member.id) ? (
                                                                <span className={cx(SECONDARY_BTN, "cursor-default px-2.5 py-1.5 opacity-60")}>Added</span>
                                                            ) : (
                                                                <button type="button" className={cx(SECONDARY_BTN, "px-2.5 py-1.5")} onClick={() => handleFollow(member)}>
                                                                    Follow
                                                                </button>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            <div className="border-t border-secondary">
                                                <button
                                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-brand-secondary hover:bg-secondary"
                                                    onMouseDown={() => {
                                                        setShowDropdown(false);
                                                        setStep5View("invite");
                                                    }}
                                                >
                                                    Invite new player →
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Followed players — same row design as the Profile page (see profile.tsx) */}
                                {followedMembers.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <p className="text-sm font-medium text-secondary">Following ({followedMembers.length})</p>
                                        <div className="flex flex-col">
                                            {followedMembers.map((m) => (
                                                <div key={m.id} className="flex items-center gap-2 py-2.5">
                                                    {m.photo_url ? (
                                                        <img src={m.photo_url} alt="" referrerPolicy="no-referrer" className="size-6 shrink-0 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-secondary">
                                                            {m.first_name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate text-sm text-primary">
                                                        {rowName(m.first_name, m.last_name, m.skill_level)}
                                                    </span>
                                                    {/* Fixed-width centered slot so the action lines up with the Follow buttons below */}
                                                    <div className="flex w-24 shrink-0 justify-center">
                                                        <button
                                                            onClick={() => handleUnfollow(m.id)}
                                                            className="text-sm font-medium text-brand-secondary hover:text-brand-secondary_hover"
                                                        >
                                                            Unfollow
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recently joined players */}
                                {suggestedFollows.length > 0 && memberQuery.trim().length < 2 && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-medium text-secondary">Recently joined</p>
                                        <ul className="flex flex-col gap-1">
                                            {suggestedFollows.filter((s) => !followedIds.has(s.id)).map((su) => (
                                                <li key={su.id} className="flex items-center gap-3 py-1.5">
                                                    {su.photo_url ? (
                                                        <img src={su.photo_url} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary text-sm font-medium text-secondary">
                                                            {su.first_name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium text-primary">{su.first_name} {su.last_name}</p>
                                                        {su.skill_level && <p className="text-xs text-tertiary">{su.skill_level} NTRP</p>}
                                                    </div>
                                                    <div className="flex w-24 shrink-0 justify-center">
                                                        <button type="button" className={cx(SECONDARY_BTN, "px-2.5 py-1.5")} onClick={() => handleFollow(su)}>
                                                            Follow
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {error && <p className="text-sm text-error-primary">{error}</p>}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Footer navigation */}
            <div className="sticky bottom-0 flex items-center justify-between bg-secondary px-4 pt-3 pb-[calc(0.75rem_+_var(--safe-bottom))]">
                {step > 1 ? (
                    <button type="button" className={SECONDARY_BTN} onClick={() => setStep((s) => s - 1)}>
                        Back
                    </button>
                ) : (
                    <div />
                )}

                {step < 3 ? (
                    <button
                        type="button"
                        className={PRIMARY_BTN}
                        disabled={!canProceed()}
                        onClick={() => canProceed() && setStep((s) => s + 1)}
                    >
                        Continue
                    </button>
                ) : (
                    <button
                        type="button"
                        className={`${PRIMARY_BTN} relative`}
                        disabled={saving}
                        onClick={handleFinish}
                    >
                        {/* The label stays in the layout and goes invisible, with
                            the spinner over it — every other button in the app
                            replaces its text rather than sitting beside it, and
                            this one is not full width, so removing the label
                            outright would shrink the button as it worked. */}
                        <span className={saving ? "invisible" : undefined}>Get started</span>
                        {saving && (
                            <Spinner
                                size="sm"
                                tone="on-brand"
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                            />
                        )}
                    </button>
                )}
            </div>

            {/* Positioning the photo, before anything is stored. */}
            {cropping && (
                <AvatarCropper file={cropping} busy={photoBusy} onCancel={cancelCrop} onConfirm={uploadAvatar} />
            )}
        </div>
    );
}
