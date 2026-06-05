import { useEffect, useRef, useState } from "react";
import type { Selection } from "react-aria-components";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { MultiSelect } from "@/components/base/select/multi-select";
import { Select } from "@/components/base/select/select";
import { SelectItem } from "@/components/base/select/select-item";
import { Toggle } from "@/components/base/toggle/toggle";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";

const SKILL_LEVELS = [
    { id: "2.5", label: "2.5 — Beginner" },
    { id: "3.0", label: "3.0 — Beginner+" },
    { id: "3.5", label: "3.5 — Intermediate" },
    { id: "4.0", label: "4.0 — Intermediate+" },
    { id: "4.5", label: "4.5 — Advanced" },
    { id: "5.0", label: "5.0 — Expert" },
];

const NOTIFICATION_TYPES = [
    "claim_submitted",
    "claim_approved",
    "claim_rejected",
    "claimer_backed_out",
    "cost_changed",
    "nudge_12h",
    "nudge_48h",
    "price_drop",
    "spot_reopened",
    "game_reminder",
    "friend_expiry",
];

interface FormData {
    first_name: string;
    last_name: string;
    skill_level: string;
    tos_accepted: boolean;
    headline: string;
    photo_file: File | null;
    photo_url: string;
    court_preferences: Selection;
    pro_preference: string;
    new_to_westport: boolean;
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
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteConfirmEmail, setInviteConfirmEmail] = useState<string | null>(null);
    const [suggestedFollows, setSuggestedFollows] = useState<MemberResult[]>([]);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState<FormData>({
        first_name: "",
        last_name: "",
        skill_level: "",
        tos_accepted: false,
        headline: "",
        photo_file: null,
        photo_url: "",
        court_preferences: new Set<string>(),
        pro_preference: "",
        new_to_westport: false,
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


    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        set("photo_file", file);
        const ext = file.name.split(".").pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
        if (!error) {
            const { data } = supabase.storage.from("avatars").getPublicUrl(path);
            set("photo_url", data.publicUrl);
        }
    };

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
            const { data } = await supabase
                .from("users")
                .select("id, first_name, last_name, photo_url, skill_level, headline")
                .or(`first_name.ilike.%${memberQuery.trim()}%,last_name.ilike.%${memberQuery.trim()}%`)
                .neq("id", user.id)
                .limit(8);
            setMemberResults(data ?? []);
            setShowDropdown(true);
            setSearchLoading(false);
        }, 300);
        return () => clearTimeout(t);
    }, [memberQuery, user]);

    // Fetch suggested follows when entering step 5
    useEffect(() => {
        if (step !== 5) return;
        supabase.rpc("get_suggested_follows").then(({ data }) => {
            if (data) setSuggestedFollows(data as MemberResult[]);
        });
    }, [step]);

    const handleFollow = async (memberId: string) => {
        if (!user || followedIds.has(memberId)) return;
        await supabase.from("follows").insert({ follower_id: user.id, following_id: memberId });
        setFollowedIds((prev) => new Set([...prev, memberId]));
    };

    const handleSendInvite = async () => {
        if (!user || !isValidEmail(inviteEmail)) return;
        setInviteSending(true);
        try {
            await supabase.from("invites").insert({ inviter_id: user.id, email: inviteEmail.trim() });
            // Attempt edge function delivery — silently skipped if not yet deployed
            await supabase.functions.invoke("send-invite", { body: { email: inviteEmail.trim(), inviter_id: user.id } }).catch(() => {});
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
                headline: form.headline.trim() || null,
                photo_url: form.photo_url || null,
                court_preferences: courtPrefs.length > 0 ? courtPrefs : null,
                pro_preference: form.pro_preference.trim() || null,
                new_to_westport: form.new_to_westport,
                phone: encryptedPhone,
                venmo_handle: encryptedVenmo,
            }).select();

            if (insertError) throw insertError;
            if (!savedUser || savedUser.length === 0) throw new Error("Profile was not saved — upsert returned no rows. Check RLS policies.");
            // Set profile in global context so ProtectedRoute sees it immediately
            setProfile(savedUser[0]);

            // Insert notification preferences
            await supabase.from("notification_preferences").upsert(
                NOTIFICATION_TYPES.map((type) => ({
                    user_id: user.id,
                    notification_type: type,
                    push_enabled: form.push_enabled,
                    email_enabled: form.email_enabled,
                })),
                { onConflict: "user_id,notification_type" },
            );

            const redirect = sessionStorage.getItem("cs_auth_redirect");
            sessionStorage.removeItem("cs_auth_redirect");
            navigate(redirect ?? "/feed", { replace: true });
        } catch (e) {
            console.error("handleFinish error:", e);
            setError(e instanceof Error ? e.message : (e as any)?.message ?? JSON.stringify(e) ?? "Something went wrong. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const courtItems = courts.map((c) => ({ id: c.id, label: c.name, supportingText: c.area ?? undefined }));

    return (
        <div className="flex min-h-dvh flex-col bg-primary">
            {/* Progress bar */}
            <div className="flex gap-1 px-4 pt-6">
                {[1, 2, 3, 4, 5].map((s) => (
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
                            {form.photo_url ? (
                                <img
                                    src={form.photo_url}
                                    alt="Profile photo"
                                    referrerPolicy="no-referrer"
                                    className="size-16 shrink-0 rounded-full object-cover ring-2 ring-brand-solid"
                                />
                            ) : (
                                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-tertiary text-xl font-semibold text-quaternary">
                                    {form.first_name.charAt(0).toUpperCase() || "?"}
                                </div>
                            )}
                            <div>
                                <h1 className="text-xl font-semibold text-primary">Create your profile</h1>
<label className="mt-1.5 inline-block cursor-pointer text-sm font-semibold text-brand-secondary hover:text-brand-secondary_hover">
                                    {form.photo_url ? "Change photo" : "Upload photo"}
                                    <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
                                </label>
                            </div>
                        </div>
                        <Input
                            label="First name"
                            placeholder="Jane"
                            value={form.first_name}
                            onChange={(v) => set("first_name", v)}
                            isRequired
                        />
                        <Input
                            label="Last name"
                            placeholder="Doe"
                            value={form.last_name}
                            onChange={(v) => set("last_name", v)}
                            isRequired
                        />
                        <Select
                            label="Skill level (NTRP)"
                            placeholder="Select your level"
                            items={SKILL_LEVELS}
                            selectedKey={form.skill_level || null}
                            onSelectionChange={(k) => set("skill_level", k as string)}
                            isRequired
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>
                        <Checkbox
                            label={
                                <span className="text-sm text-secondary">
                                    I agree to the{" "}
                                    <a href="/terms" target="_blank" className="text-brand-secondary underline">Terms of Service</a>
                                    {" "}and{" "}
                                    <a href="/privacy" target="_blank" className="text-brand-secondary underline">Privacy Policy</a>
                                </span>
                            }
                            isSelected={form.tos_accepted}
                            onChange={(v) => set("tos_accepted", v)}
                        />
                    </div>
                )}

                {/* Step 2: Optional profile fields */}
                {step === 2 && (
                    <div className="flex flex-col gap-5">
                        <div>
                            <h1 className="text-xl font-semibold text-primary">Add more about you</h1>
                            <p className="mt-1 text-sm text-tertiary">Optional — helps others find the right match.</p>
                        </div>

                        <Input
                            label="Headline"
                            placeholder="e.g. 4.0 player, Saugatuck Shores regular"
                            value={form.headline}
                            onChange={(v) => set("headline", v)}
                        />

                        <MultiSelect
                            label="Preferred courts"
                            placeholder="Select courts"
                            items={courtItems.length > 0 ? courtItems : [{ id: "_empty", label: "No courts listed yet" }]}
                            selectedKeys={form.court_preferences}
                            onSelectionChange={(keys) => set("court_preferences", keys)}
                        >
                            {(item) => <SelectItem id={item.id} supportingText={item.supportingText}>{item.label}</SelectItem>}
                        </MultiSelect>

                        <Input
                            label="Preferred pro / instructor"
                            placeholder="e.g. Mike at Longshore"
                            value={form.pro_preference}
                            onChange={(v) => set("pro_preference", v)}
                        />

                        <Toggle
                            size="sm"
                            label="New to Westport"
                            hint="I'm new to the Westport tennis scene"
                            isSelected={form.new_to_westport}
                            onChange={(v) => set("new_to_westport", v)}
                        />
                    </div>
                )}

                {/* Step 3: Contact + payment */}
                {step === 3 && (
                    <div className="flex flex-col gap-5">
                        <div>
                            <h1 className="text-xl font-semibold text-primary">Contact & payment</h1>
                            <p className="mt-1 text-sm text-tertiary">Only shared with your approved match partner.</p>
                        </div>
                        <Input
                            label="Phone number"
                            type="tel"
                            placeholder="+1 (203) 555-0100"
                            value={form.phone}
                            onChange={(v) => set("phone", v)}
                            hint="Encrypted and only visible after a claim is approved."
                        />
                        <Input
                            label="Venmo handle"
                            placeholder="@yourhandle"
                            value={form.venmo_handle}
                            onChange={(v) => set("venmo_handle", v)}
                            hint="Used to generate payment requests. Encrypted and only visible after approval."
                        />
                    </div>
                )}

                {/* Step 4: Notification preferences */}
                {step === 4 && (
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

                {/* Step 5: Invite players */}
                {step === 5 && (
                    <div className="flex flex-col gap-5">
                        {step5View === "invite" ? (
                            /* ── Invite sub-view ── */
                            <>
                                <button
                                    className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary"
                                    onClick={() => setStep5View("search")}
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
                                />
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
                                    <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2.5 ring-1 ring-inset ring-primary focus-within:ring-2 focus-within:ring-brand">
                                        <SearchLg className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                        <input
                                            className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-placeholder"
                                            placeholder="Search by name…"
                                            value={memberQuery}
                                            onChange={(e) => setMemberQuery(e.target.value)}
                                            onFocus={() => memberQuery.trim().length >= 2 && setShowDropdown(true)}
                                            autoComplete="off"
                                        />
                                    </div>

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
                                                            <Button
                                                                size="xs"
                                                                color={followedIds.has(member.id) ? "secondary" : "primary"}
                                                                isDisabled={followedIds.has(member.id)}
                                                                onClick={() => handleFollow(member.id)}
                                                            >
                                                                {followedIds.has(member.id) ? "Added" : "Follow"}
                                                            </Button>
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

                                {/* Followed players list */}
                                {followedIds.size > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <p className="text-sm font-medium text-secondary">Following ({followedIds.size})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {memberResults
                                                .filter((m) => followedIds.has(m.id))
                                                .map((m) => (
                                                    <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-brand-secondary px-2.5 py-1 text-sm font-medium text-brand-primary">
                                                        {m.first_name} {m.last_name}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* Suggested follows */}
                                {suggestedFollows.length > 0 && memberQuery.trim().length < 2 && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-medium text-secondary">People you might know</p>
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
                                                    <Button size="xs" color="primary" onClick={() => handleFollow(su.id)}>
                                                        Follow
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <p className="text-center text-xs text-tertiary">Optional — you can follow players and send invites any time from your profile.</p>

                                {error && <p className="text-sm text-error-primary">{error}</p>}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Footer navigation */}
            <div className="sticky bottom-0 flex items-center justify-between border-t border-secondary bg-primary px-4 py-3">
                {step > 1 ? (
                    <Button color="secondary" size="md" onClick={() => setStep((s) => s - 1)}>
                        Back
                    </Button>
                ) : (
                    <div />
                )}

                {step < 5 ? (
                    <Button
                        color="primary"
                        size="md"
                        isDisabled={!canProceed()}
                        onClick={() => canProceed() && setStep((s) => s + 1)}
                    >
                        Continue
                    </Button>
                ) : (
                    <Button
                        color="primary"
                        size="md"
                        isLoading={saving}
                        showTextWhileLoading
                        onClick={handleFinish}
                    >
                        Get started
                    </Button>
                )}
            </div>
        </div>
    );
}
