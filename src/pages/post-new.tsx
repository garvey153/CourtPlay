import { useEffect, useMemo, useRef, useState } from "react";
import type { DateValue } from "react-aria-components";
import { TimeField as AriaTimeField } from "react-aria-components";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { parseDate, parseTime, today, getLocalTimeZone } from "@internationalized/date";
import { XClose } from "@untitledui/icons";
import { InputDateBase } from "@/components/base/input/input-date";
import { DateFieldSelect } from "@/components/app/date-field-select";
import { Input } from "@/components/base/input/input";
import { MultiSelect } from "@/components/base/select/multi-select";
import { Select } from "@/components/base/select/select";
import { SelectItem } from "@/components/base/select/select-item";
import { TextArea } from "@/components/base/textarea/textarea";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { upsertCustomCourt } from "@/lib/custom-court";
import { sendNotificationBatch } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import type { Selection } from "react-aria-components";
import { cx } from "@/utils/cx";

// Field surface per the design: text inputs get a bg/tertiary fill with a
// border/tertiary outline; dropdowns get the fill only (no border).
const FIELD = "bg-tertiary ring-neutral-600";
const FIELD_SELECT = "bg-tertiary ring-0 shadow-none";

// Design-system buttons (node 32-85): primary = bg/brand + on-brand text;
// secondary = bg/tertiary + secondary text.
const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "rounded-lg bg-tertiary px-4 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-brand-800";

// A dropdown is sized to fit its longest option (and its placeholder, so the
// resting text never clips), capped to the sheet width. Measured with canvas so
// the width tracks the real glyph widths of the font, not a per-char estimate.
let _measureCanvas: HTMLCanvasElement | null = null;
// extraPx reserves room for a left checkbox in the option rows (24 ≈ box + gap),
// since the options popover is the same width as the trigger.
function menuWidth(items: { label: string }[], placeholder = "", extraPx = 0) {
    if (typeof document === "undefined") return undefined;
    _measureCanvas ??= document.createElement("canvas");
    const ctx = _measureCanvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.font = "500 14px Inter, system-ui, sans-serif";
    const texts = [placeholder, ...items.map((i) => i.label)];
    const max = texts.reduce((m, t) => Math.max(m, ctx.measureText(t).width), 0);
    if (!max) return undefined;
    // + padding (px-3 ×2 = 24) + chevron (16) + gaps/buffer + optional checkbox room.
    return { width: `${Math.ceil(max) + 44 + extraPx}px`, maxWidth: "100%" as const };
}

// Width for a checkbox multi-select: fits the longest option (with checkbox room)
// and the "N selected" summary the trigger shows once items are picked.
function multiMenuWidth(items: { label: string }[], placeholder = "") {
    return menuWidth([...items, { label: `${items.length} selected` }], placeholder, 24);
}

// Play type supersedes `format` for sub_need posts; drives the feed card title.
const PLAY_TYPES = [
    { id: "doubles", label: "Doubles" },
    { id: "point_play", label: "Point play" },
    { id: "clinic", label: "Clinic" },
    { id: "round_robin", label: "Round robin" },
    { id: "lesson", label: "Lesson" },
    { id: "other", label: "Other" },
];

const DURATIONS = [
    { id: "1", label: "1 hr" },
    { id: "1.5", label: "1.5 hrs" },
    { id: "2", label: "2 hrs" },
    { id: "2.5", label: "2.5 hrs" },
    { id: "3", label: "3 hrs" },
];

// Descriptive NTRP labels, matching the feed filter. ids stay within the DB
// skill_level check constraint (2.5–5.0).
const SKILL_LEVELS = [
    { id: "2.5", label: "NTRP 2.5 (Advanced Beginner)" },
    { id: "3.0", label: "NTRP 3.0 (Lower-Intermediate)" },
    { id: "3.5", label: "NTRP 3.5 (Intermediate)" },
    { id: "4.0", label: "NTRP 4.0 (Intermediate-Advanced)" },
    { id: "4.5", label: "NTRP 4.5 (Advanced)" },
    { id: "5.0", label: "NTRP 5.0 to 7.0 (Pro)" },
];

const GROUP_SIZES = [2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: String(n), label: String(n) }));

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ id: d, label: d }));
const TIMES_OF_DAY = [
    { id: "Morning", label: "Morning" },
    { id: "Midday", label: "Midday" },
    { id: "Afternoon", label: "Afternoon" },
    { id: "Evening", label: "Evening" },
];

const POST_TYPES = [
    {
        id: "sub_need" as const,
        title: "Find a sub",
        desc: "Post a specific date, time, and court to fill an open spot and recoup the cost.",
    },
    {
        id: "regular_game" as const,
        title: "Find a regular game",
        desc: "Post your availability and preferences to connect with ongoing groups.",
    },
];

interface Court { id: string; name: string; area: string | null }

/** Section label with an optional required asterisk. */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label className="text-sm font-medium text-secondary">
            {children}
            {required && <span> *</span>}
        </label>
    );
}

// Fields that make up a post, used to detect unsaved changes in edit mode.
interface FormFields {
    postType: string;
    playType: string;
    duration: number | null;
    gameDate: string | null;
    gameTime: string;
    skillLevel: string;
    courtId: string | null;
    showCustomCourt: boolean;
    customCourt: string;
    proName: string;
    cost: number | null;
    notes: string;
    rgPlayTypes: string[];
    rgGroupSizes: string[];
    rgSkillLevels: string[];
    rgDays: string[];
    rgTimes: string[];
    rgCourts: string[];
    rgNote: string;
}

const keysOf = (s: Selection): string[] => (s instanceof Set ? [...s].map(String) : []);

// Order-independent signature of the form's values (multi-selects are sorted).
const buildFormSig = (v: FormFields): string =>
    JSON.stringify({
        ...v,
        rgPlayTypes: [...v.rgPlayTypes].sort(),
        rgGroupSizes: [...v.rgGroupSizes].sort(),
        rgSkillLevels: [...v.rgSkillLevels].sort(),
        rgDays: [...v.rgDays].sort(),
        rgTimes: [...v.rgTimes].sort(),
        rgCourts: [...v.rgCourts].sort(),
    });

export function PostNew() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const editPostId = searchParams.get("edit");
    // Where to go when the sheet closes (set by whoever opened the edit form, e.g.
    // the Activity Created tab). Falls back to a plain back-navigation.
    const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? null;
    const closeForm = () => (returnTo ? navigate(returnTo) : navigate(-1));

    const [postType, setPostType] = useState<"sub_need" | "regular_game">("sub_need");
    const [courts, setCourts] = useState<Court[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitHit, setRateLimitHit] = useState(false);

    // sub_need fields
    const [playType, setPlayType] = useState("");
    const [duration, setDuration] = useState<number | null>(null);
    const [gameDate, setGameDate] = useState<DateValue | null>(null);
    const [gameTime, setGameTime] = useState("09:00");
    // The default time shows in secondary until the user actually sets it.
    const [timeTouched, setTimeTouched] = useState(false);
    const [skillLevel, setSkillLevel] = useState("");
    const [courtId, setCourtId] = useState<string | null>(null);
    const [showCustomCourt, setShowCustomCourt] = useState(false);
    const [customCourt, setCustomCourt] = useState("");
    const [proName, setProName] = useState("");
    const [cost, setCost] = useState<number | null>(null);
    const [notes, setNotes] = useState("");

    // regular_game fields (multi-select preferences)
    const [rgPlayTypes, setRgPlayTypes] = useState<Selection>(new Set());
    const [rgGroupSizes, setRgGroupSizes] = useState<Selection>(new Set());
    const [rgSkillLevels, setRgSkillLevels] = useState<Selection>(new Set());
    const [rgDays, setRgDays] = useState<Selection>(new Set());
    const [rgTimes, setRgTimes] = useState<Selection>(new Set());
    const [rgCourts, setRgCourts] = useState<Selection>(new Set());
    const [rgNote, setRgNote] = useState("");

    // edit mode state — init from the URL so the header/fields never flash the
    // "create" state before the edit data loads.
    const [existingClaims, setExistingClaims] = useState(false);
    const [isEditing, setIsEditing] = useState(!!editPostId);
    // In edit mode the form is hidden until the post is fetched; create mode is ready immediately.
    const [loaded, setLoaded] = useState(!editPostId);
    const [originalCost, setOriginalCost] = useState<number | null>(null);

    useEffect(() => {
        supabase.from("courts").select("id, name, area").eq("active", true).order("name")
            .then(({ data }) => setCourts(data ?? []));
    }, []);

    // Close the form sheet on Escape (matches the other bottom sheets).
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeForm();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [returnTo]);

    // Load post for editing — once per post id. Keyed on user?.id (a stable string)
    // and guarded by a ref so a new useAuth() object reference can't re-trigger the fetch.
    const loadedIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (!editPostId || !user?.id) return;
        if (loadedIdRef.current === editPostId) return;
        loadedIdRef.current = editPostId;
        setIsEditing(true);
        Promise.all([
            supabase.from("posts").select("*").eq("id", editPostId).single(),
            supabase.from("claims").select("id").eq("post_id", editPostId).in("status", ["pending", "approved"]).limit(1),
        ]).then(([{ data: post }, { data: claims }]) => {
            if (!post) {
                setLoaded(true);
                return;
            }
            setPostType(post.post_type);
            setExistingClaims((claims ?? []).length > 0);
            if (post.post_type === "sub_need") {
                setPlayType(post.play_type ?? "");
                setDuration(post.duration != null ? Number(post.duration) : null);
                setGameDate(post.game_date ? parseDate(post.game_date) : null);
                setGameTime(post.game_time ? post.game_time.slice(0, 5) : "09:00");
                setTimeTouched(true);
                setSkillLevel(post.skill_level ?? "");
                setCourtId(post.court_id ?? null);
                setCustomCourt(post.custom_court ?? "");
                setShowCustomCourt(!!post.custom_court && !post.court_id);
                setProName(post.pro_name ?? "");
                const postCost = post.cost ? Number(post.cost) : null;
                setCost(postCost);
                setOriginalCost(postCost);
                setNotes(post.notes ?? "");
            } else {
                setRgPlayTypes(new Set(post.play_type ? [post.play_type] : []));
                setRgGroupSizes(new Set(post.total_players != null ? [String(post.total_players)] : []));
                setRgSkillLevels(new Set(post.skill_level ? [post.skill_level] : []));
                setRgDays(new Set(post.preferred_days ?? []));
                setRgTimes(new Set(post.preferred_times ?? []));
                setRgCourts(new Set(post.court_id ? [post.court_id] : []));
                setRgNote(post.notes ?? "");
            }
            // Baseline signature from the loaded values — must mirror the setters above
            // exactly so an untouched form reads as "not dirty".
            setInitialSig(
                buildFormSig(
                    post.post_type === "sub_need"
                        ? {
                              postType: post.post_type,
                              playType: post.play_type ?? "",
                              duration: post.duration != null ? Number(post.duration) : null,
                              gameDate: post.game_date ?? null,
                              gameTime: post.game_time ? post.game_time.slice(0, 5) : "09:00",
                              skillLevel: post.skill_level ?? "",
                              courtId: post.court_id ?? null,
                              showCustomCourt: !!post.custom_court && !post.court_id,
                              customCourt: post.custom_court ?? "",
                              proName: post.pro_name ?? "",
                              cost: post.cost ? Number(post.cost) : null,
                              notes: post.notes ?? "",
                              rgPlayTypes: [],
                              rgGroupSizes: [],
                              rgSkillLevels: [],
                              rgDays: [],
                              rgTimes: [],
                              rgCourts: [],
                              rgNote: "",
                          }
                        : {
                              postType: post.post_type,
                              playType: "",
                              duration: null,
                              gameDate: null,
                              gameTime: "09:00",
                              skillLevel: "",
                              courtId: null,
                              showCustomCourt: false,
                              customCourt: "",
                              proName: "",
                              cost: null,
                              notes: "",
                              rgPlayTypes: post.play_type ? [post.play_type] : [],
                              rgGroupSizes: post.total_players != null ? [String(post.total_players)] : [],
                              rgSkillLevels: post.skill_level ? [post.skill_level] : [],
                              rgDays: post.preferred_days ?? [],
                              rgTimes: post.preferred_times ?? [],
                              rgCourts: post.court_id ? [post.court_id] : [],
                              rgNote: post.notes ?? "",
                          },
                ),
            );
            setLoaded(true);
        });
    }, [editPostId, user?.id]);

    const courtItems = [
        ...courts.map((c) => ({ id: c.id, label: c.name, supportingText: c.area ?? undefined })),
        { id: "__custom__", label: "Add custom court…" },
    ];

    const handleCourtSelect = (key: string | number | null) => {
        if (key === "__custom__") {
            setCourtId(null);
            setShowCustomCourt(true);
        } else {
            setCourtId(key as string | null);
            setShowCustomCourt(false);
            setCustomCourt("");
        }
    };

    const validateSubNeed = () =>
        !!(playType && gameDate && gameTime && duration != null && skillLevel && (courtId || customCourt.trim()) && cost !== null && notes.trim());

    const setSize = (s: Selection) => (s instanceof Set ? s.size : 0);
    const validateRegularGame = () =>
        setSize(rgPlayTypes) > 0 && setSize(rgSkillLevels) > 0 && !!rgNote.trim();

    // ── Dirty tracking (edit mode) ──────────────────────────────────────────
    // In edit mode "Save changes" stays disabled until the user actually changes
    // something. A signature of every field lets us compare against the loaded post.
    const formSig = useMemo(
        () =>
            buildFormSig({
                postType,
                playType,
                duration,
                gameDate: gameDate?.toString() ?? null,
                gameTime,
                skillLevel,
                courtId,
                showCustomCourt,
                customCourt,
                proName,
                cost,
                notes,
                rgPlayTypes: keysOf(rgPlayTypes),
                rgGroupSizes: keysOf(rgGroupSizes),
                rgSkillLevels: keysOf(rgSkillLevels),
                rgDays: keysOf(rgDays),
                rgTimes: keysOf(rgTimes),
                rgCourts: keysOf(rgCourts),
                rgNote,
            }),
        [postType, playType, duration, gameDate, gameTime, skillLevel, courtId, showCustomCourt, customCourt, proName, cost, notes, rgPlayTypes, rgGroupSizes, rgSkillLevels, rgDays, rgTimes, rgCourts, rgNote],
    );
    // Baseline captured directly from the loaded post (in the load effect), so it's
    // race-free — no dependency on when state/effects flush.
    const [initialSig, setInitialSig] = useState<string | null>(null);
    // Create mode is always "dirty"; edit mode only once a field differs from the load.
    const dirty = !isEditing || (initialSig !== null && formSig !== initialSig);

    const handleSubmit = async () => {
        if (!user) return;
        setSaving(true);
        setError(null);

        try {
            // Id of the row created this submit (null when editing).
            let newPostId: string | null = null;

            if (!isEditing) {
                // Rate limit check
                const { count } = await supabase
                    .from("posts")
                    .select("id", { count: "exact", head: true })
                    .eq("author_id", user.id)
                    .eq("status", "active");
                if ((count ?? 0) >= 5) {
                    setRateLimitHit(true);
                    setSaving(false);
                    return;
                }
            }

            if (postType === "sub_need") {
                const usedCustomCourt = showCustomCourt && customCourt.trim();
                if (usedCustomCourt) await upsertCustomCourt(customCourt.trim());
                const location = usedCustomCourt ? customCourt.trim() : courts.find((c) => c.id === courtId)?.name ?? null;

                if (isEditing && editPostId) {
                    const { error: updateError } = await supabase.from("posts").update({
                        ...(existingClaims ? {} : {
                            play_type: playType,
                            duration,
                            game_date: gameDate?.toString(),
                            game_time: gameTime,
                            skill_level: skillLevel,
                            court_id: courtId,
                            custom_court: usedCustomCourt ? customCourt.trim() : null,
                            location,
                            pro_name: proName || null,
                        }),
                        cost,
                        notes: notes || null,
                    }).eq("id", editPostId);
                    if (updateError) throw updateError;

                    // N5: Cost changed — notify active claimers
                    const activeClaimerIds = new Set<string>();
                    if (originalCost !== null && cost !== null && originalCost !== cost) {
                        const { data: activeClaims } = await supabase
                            .from("claims")
                            .select("claimer_id")
                            .eq("post_id", editPostId)
                            .in("status", ["pending", "approved"]);

                        if (activeClaims && activeClaims.length > 0) {
                            for (const c of activeClaims) activeClaimerIds.add(c.claimer_id);
                            sendNotificationBatch([...activeClaimerIds], "cost_changed", editPostId, {
                                old_cost: originalCost.toFixed(2),
                                new_cost: cost.toFixed(2),
                            });
                        }
                    }

                    // N8: Price drop — notify prior viewers (exclude poster and active claimers)
                    if (originalCost !== null && cost !== null && cost < originalCost) {
                        const { data: viewers } = await supabase
                            .from("post_views")
                            .select("user_id")
                            .eq("post_id", editPostId)
                            .neq("user_id", user.id);

                        if (viewers && viewers.length > 0) {
                            const viewerIds = viewers
                                .map((v) => v.user_id)
                                .filter((id) => !activeClaimerIds.has(id));
                            if (viewerIds.length > 0) {
                                sendNotificationBatch(viewerIds, "price_drop", editPostId, {
                                    old_cost: originalCost.toFixed(2),
                                    new_cost: cost.toFixed(2),
                                });
                            }
                        }
                    }
                } else {
                    const { data: inserted, error: insertError } = await supabase.from("posts").insert({
                        author_id: user.id,
                        post_type: "sub_need",
                        play_type: playType,
                        duration,
                        game_date: gameDate?.toString(),
                        game_time: gameTime,
                        skill_level: skillLevel,
                        court_id: courtId,
                        custom_court: usedCustomCourt ? customCourt.trim() : null,
                        location,
                        pro_name: proName || null,
                        cost,
                        spots_total: 1,
                        notes: notes || null,
                    }).select("id");
                    if (insertError) throw insertError;
                    newPostId = inserted?.[0]?.id ?? null;

                    // N13: Friend new post — notify followers (opt-in only)
                    const { data: followers } = await supabase
                        .from("follows")
                        .select("follower_id")
                        .eq("following_id", user.id);

                    if (followers && followers.length > 0 && inserted && inserted.length > 0) {
                        const followerIds = followers.map((f) => f.follower_id);
                        const { data: posterInfo } = await supabase
                            .from("users")
                            .select("first_name")
                            .eq("id", user.id)
                            .single();
                        sendNotificationBatch(followerIds, "friend_new_post", inserted[0].id, {
                            poster_name: posterInfo?.first_name ?? "",
                            post_summary: location ?? "",
                        });
                    }
                }
            } else {
                const asArr = (s: Selection) => (s instanceof Set ? [...(s as Set<string>)] : []);
                const dayArr = asArr(rgDays);
                const timeArr = asArr(rgTimes);
                const courtArr = asArr(rgCourts);
                const playTypeArr = asArr(rgPlayTypes);
                const skillArr = asArr(rgSkillLevels);
                const sizeArr = asArr(rgGroupSizes).map(Number);
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);

                // Persist to the columns that exist on `posts`. The multi-selects keep
                // their primary value in the single columns (play_type / total_players /
                // skill_level / court_id) — the ones the feed card, detail sheet and
                // filters actually read.
                const rgFields = {
                    play_type: playTypeArr[0] ?? null,
                    total_players: sizeArr[0] ?? null,
                    skill_level: skillArr[0] ?? null,
                    court_id: courtArr[0] ?? null,
                    preferred_days: dayArr,
                    preferred_times: timeArr,
                    notes: rgNote || null,
                };

                if (isEditing && editPostId) {
                    const { error: updateError } = await supabase.from("posts").update(rgFields).eq("id", editPostId);
                    if (updateError) throw updateError;
                } else {
                    const { data: inserted, error: insertError } = await supabase
                        .from("posts")
                        .insert({
                            author_id: user.id,
                            post_type: "regular_game",
                            ...rgFields,
                            expires_at: expiresAt.toISOString(),
                        })
                        .select("id");
                    if (insertError) throw insertError;
                    newPostId = inserted?.[0]?.id ?? null;
                }
            }

            // Editing returns to wherever the form was opened from (e.g. the Activity
            // Created tab). Creating shows the success banner on the feed.
            if (isEditing) {
                if (returnTo) navigate(returnTo);
                else navigate("/feed");
            } else {
                if (newPostId) {
                    localStorage.setItem(
                        "courtsub_post_created",
                        JSON.stringify({ id: newPostId, type: postType }),
                    );
                }
                navigate("/feed");
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setSaving(false);
        }
    };

    const lockedField = isEditing && existingClaims;
    const lockedTitle = "Cancel and repost to change game details.";

    return (
        <AppLayout>
            {/* Dim + blur the page/header behind the sheet (matches the filter sheet).
                Clicking it (e.g. the header area) closes the sheet. */}
            <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[8px]"
                onClick={closeForm}
                aria-hidden="true"
            />
            {/* Full-height sheet: spans the whole screen with the form scrolling inside. */}
            <div className="pointer-events-none fixed inset-0 z-50 flex justify-center">
                <div className="pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden bg-secondary shadow-xl">
                    {/* Sheet header — pinned */}
                    <div className="relative shrink-0 px-5 pt-[18px] pb-5">
                        <h1 className="pr-9 text-lg font-semibold text-primary">
                            {isEditing ? "Edit post" : "Create a new post"}
                        </h1>
                        <button
                            type="button"
                            onClick={closeForm}
                            aria-label="Close"
                            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-tertiary transition duration-100 ease-linear hover:text-secondary"
                        >
                            <XClose className="size-5" />
                        </button>
                    </div>

                    {/* Scrolling form body */}
                    <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 pb-8">
                {!loaded ? (
                    // Edit mode: hold the sheet until the post loads so the create form never flashes.
                    <div className="flex items-center justify-center py-20">
                        <span className="size-6 animate-spin rounded-full border-2 border-secondary border-t-transparent" aria-hidden="true" />
                    </div>
                ) : (
                <>
                {/* Post type — radio cards (hidden in edit mode) */}
                {!isEditing && (
                    <div className="mb-7 flex flex-col gap-3">
                        <FieldLabel required>Select a post type</FieldLabel>
                        {POST_TYPES.map((t) => {
                            const selected = postType === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setPostType(t.id)}
                                    className={cx(
                                        // Always border-2 (color-only change) so the card's inner width — and
                                        // therefore the description wrapping — stays constant when toggling.
                                        "flex items-start gap-2 rounded-lg border-2 bg-tertiary p-4 text-left transition duration-100 ease-linear",
                                        selected ? "border-brand" : "border-neutral-600 hover:border-neutral-500",
                                    )}
                                >
                                    <span
                                        className={cx(
                                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                                            selected ? "bg-brand-solid" : "border border-neutral-600",
                                        )}
                                    >
                                        {selected && <span className="size-1.5 rounded-full bg-white" />}
                                    </span>
                                    <span className="flex min-w-0 flex-col">
                                        <span className="text-sm font-medium text-primary">{t.title}</span>
                                        <span className="text-sm text-secondary">{t.desc}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {rateLimitHit && (
                    <p className="mb-4 rounded-lg bg-warning-primary px-3 py-2 text-sm text-warning-primary">
                        You already have 5 active posts. Close one before posting again.
                    </p>
                )}

                {/* ── Find a sub form ── */}
                {postType === "sub_need" && (
                    <div className="flex flex-col gap-5">
                        <Select
                            label="Play type"
                            placeholder="Select type"
                            isNonModal
                            items={PLAY_TYPES}
                            triggerStyle={menuWidth(PLAY_TYPES, "Select type")}
                            selectedKey={playType || null}
                            onSelectionChange={(k) => setPlayType(k as string)}
                            isRequired
                            isDisabled={lockedField}
                            tooltip={lockedField ? lockedTitle : undefined}
                            size="sm"
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>

                        {/* Court selection */}
                        {!showCustomCourt ? (
                            <Select
                                label="Location"
                                placeholder="Select court"
                                isNonModal
                                items={courtItems}
                                selectedKey={courtId}
                                onSelectionChange={(k) => handleCourtSelect(k as string)}
                                isRequired
                                isDisabled={lockedField}
                                tooltip={lockedField ? lockedTitle : undefined}
                                size="sm"
                            triggerClassName={FIELD_SELECT}
                            >
                                {(item) => <SelectItem id={item.id} supportingText={item.supportingText}>{item.label}</SelectItem>}
                            </Select>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Input
                                    label="Custom court name"
                                    placeholder="e.g. Longshore Tennis Club"
                                    value={customCourt}
                                    onChange={(v) => setCustomCourt(v)}
                                    isRequired
                                    size="sm"
                                    wrapperClassName={FIELD}
                                />
                                <button
                                    onClick={() => { setShowCustomCourt(false); setCustomCourt(""); }}
                                    className="self-start text-sm text-brand-secondary"
                                >
                                    ← Back to court list
                                </button>
                            </div>
                        )}

                        {/* Date & time */}
                        <div className="flex flex-col gap-2">
                            <FieldLabel required>Date &amp; time</FieldLabel>
                            <div className="flex items-center gap-3">
                                <DateFieldSelect
                                    aria-label="Game date"
                                    value={gameDate}
                                    onChange={(v) => setGameDate(v)}
                                    minValue={today(getLocalTimeZone())}
                                    isDisabled={lockedField}
                                    className="w-[144px] shrink-0"
                                />
                                <AriaTimeField
                                    aria-label="Game time"
                                    value={gameTime ? parseTime(gameTime) : null}
                                    onChange={(t) => {
                                        if (!t) return;
                                        setGameTime(`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`);
                                        setTimeTouched(true);
                                    }}
                                    hourCycle={12}
                                    isDisabled={lockedField}
                                    // Editing a segment to the same value as the default 9:00 won't fire
                                    // onChange, so also mark the field "touched" on any edit keypress.
                                    onKeyDown={(e) => {
                                        if (/^[0-9]$/.test(e.key) || e.key === "ArrowUp" || e.key === "ArrowDown") {
                                            setTimeTouched(true);
                                        }
                                    }}
                                    className="shrink-0"
                                >
                                    <InputDateBase
                                        size="sm"
                                        wrapperClassName={cx(FIELD, "w-[96px]")}
                                        className={cx(
                                            "[&_[data-type]]:px-0 [&_[data-type=dayPeriod]]:ml-1",
                                            timeTouched
                                                ? "[&_[data-type=literal]]:text-primary"
                                                : "[&_[role=spinbutton]]:text-placeholder",
                                        )}
                                    />
                                </AriaTimeField>
                            </div>
                        </div>

                        <Select
                            label="Duration"
                            placeholder="Select duration"
                            isNonModal
                            items={DURATIONS}
                            triggerStyle={menuWidth(DURATIONS, "Select duration")}
                            selectedKey={duration != null ? String(duration) : null}
                            onSelectionChange={(k) => setDuration(k != null ? Number(k) : null)}
                            isRequired
                            isDisabled={lockedField}
                            tooltip={lockedField ? lockedTitle : undefined}
                            size="sm"
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>

                        <Select
                            label="Required skill level"
                            placeholder="Select level"
                            isNonModal
                            items={SKILL_LEVELS}
                            triggerStyle={menuWidth(SKILL_LEVELS, "Select level")}
                            selectedKey={skillLevel || null}
                            onSelectionChange={(k) => setSkillLevel(k as string)}
                            isRequired
                            isDisabled={lockedField}
                            tooltip={lockedField ? lockedTitle : undefined}
                            size="sm"
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>

                        <Input
                            label="Pro name (optional)"
                            placeholder="e.g. John Smith"
                            value={proName}
                            onChange={(v) => setProName(v)}
                            isDisabled={lockedField}
                            size="sm"
                            wrapperClassName={FIELD}
                        />

                        {/* Price — "$" is a persistent prefix so the caret sits after it;
                            no steppers, sized for $0000.00 */}
                        <div className="flex w-[120px] flex-col gap-2">
                            <FieldLabel required>Price</FieldLabel>
                            <div className="flex h-9 items-center rounded-lg bg-tertiary px-3 text-sm shadow-xs ring-1 ring-neutral-600 transition-shadow duration-100 ring-inset focus-within:ring-2">
                                <span className={cx("shrink-0", cost != null ? "text-primary" : "text-placeholder")}>$</span>
                                <input
                                    aria-label="Price"
                                    inputMode="decimal"
                                    value={cost != null ? String(cost) : ""}
                                    onChange={(e) => {
                                        const digits = e.target.value.replace(/[^0-9.]/g, "");
                                        const n = parseFloat(digits);
                                        setCost(digits === "" || isNaN(n) ? null : n);
                                    }}
                                    className="ml-0.5 w-full bg-transparent text-primary outline-none placeholder:text-placeholder"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <FieldLabel required>Message</FieldLabel>
                                <span className="text-xs text-tertiary">{notes.length}/150</span>
                            </div>
                            <TextArea
                                aria-label="Message"
                                placeholder="Anything else the sub should know…"
                                value={notes}
                                onChange={(v) => setNotes(v)}
                                maxLength={150}
                                rows={3}
                                size="sm"
                                textAreaClassName={FIELD}
                            />
                        </div>
                    </div>
                )}

                {/* ── Find a regular game form ── */}
                {postType === "regular_game" && (
                    <div className="flex flex-col gap-5">
                        <MultiSelect
                            label="Play type"
                            placeholder="Select"
                            items={PLAY_TYPES}
                            triggerStyle={multiMenuWidth(PLAY_TYPES, "Select")}
                            selectedKeys={rgPlayTypes}
                            onSelectionChange={(k) => setRgPlayTypes(k)}
                            isRequired
                            size="sm"
                            showSearch={false}
                            showFooter={false}
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => (
                                <SelectItem id={item.id} selectionIndicator="checkbox" selectionIndicatorAlign="left">
                                    {item.label}
                                </SelectItem>
                            )}
                        </MultiSelect>

                        <MultiSelect
                            label="Preferred group size"
                            placeholder="Any size"
                            items={GROUP_SIZES}
                            triggerStyle={multiMenuWidth(GROUP_SIZES, "Any size")}
                            selectedKeys={rgGroupSizes}
                            onSelectionChange={(k) => setRgGroupSizes(k)}
                            size="sm"
                            showSearch={false}
                            showFooter={false}
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => (
                                <SelectItem id={item.id} selectionIndicator="checkbox" selectionIndicatorAlign="left">
                                    {item.label}
                                </SelectItem>
                            )}
                        </MultiSelect>

                        <MultiSelect
                            label="Skill level"
                            placeholder="Select level"
                            items={SKILL_LEVELS}
                            triggerStyle={multiMenuWidth(SKILL_LEVELS, "Select level")}
                            selectedKeys={rgSkillLevels}
                            onSelectionChange={(k) => setRgSkillLevels(k)}
                            isRequired
                            size="sm"
                            showSearch={false}
                            showFooter={false}
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => (
                                <SelectItem id={item.id} selectionIndicator="checkbox" selectionIndicatorAlign="left">
                                    {item.label}
                                </SelectItem>
                            )}
                        </MultiSelect>

                        <MultiSelect
                            label="Preferred days"
                            placeholder="Any day"
                            items={DAYS}
                            triggerStyle={multiMenuWidth(DAYS, "Any day")}
                            selectedKeys={rgDays}
                            onSelectionChange={(k) => setRgDays(k)}
                            size="sm"
                            showSearch={false}
                            showFooter={false}
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => (
                                <SelectItem id={item.id} selectionIndicator="checkbox" selectionIndicatorAlign="left">
                                    {item.label}
                                </SelectItem>
                            )}
                        </MultiSelect>

                        <MultiSelect
                            label="Preferred times"
                            placeholder="Any time"
                            items={TIMES_OF_DAY}
                            triggerStyle={multiMenuWidth(TIMES_OF_DAY, "Any time")}
                            selectedKeys={rgTimes}
                            onSelectionChange={(k) => setRgTimes(k)}
                            size="sm"
                            showSearch={false}
                            showFooter={false}
                            triggerClassName={FIELD_SELECT}
                        >
                            {(item) => (
                                <SelectItem id={item.id} selectionIndicator="checkbox" selectionIndicatorAlign="left">
                                    {item.label}
                                </SelectItem>
                            )}
                        </MultiSelect>

                        <MultiSelect
                            label="Preferred locations"
                            placeholder="Any court"
                            items={courts.map((c) => ({ id: c.id, label: c.name, supportingText: c.area ?? undefined }))}
                            selectedKeys={rgCourts}
                            onSelectionChange={(k) => setRgCourts(k)}
                            size="sm"
                            showSearch={false}
                            showFooter={false}
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

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <FieldLabel required>Message</FieldLabel>
                                <span className="text-xs text-tertiary">{rgNote.length}/150</span>
                            </div>
                            <TextArea
                            aria-label="Message"
                            placeholder="Tell the group what you're looking for…"
                            value={rgNote}
                            onChange={(v) => setRgNote(v)}
                            maxLength={150}
                            rows={3}
                            size="sm"
                            textAreaClassName={FIELD}
                            />
                        </div>
                    </div>
                )}

                {error && <p className="mt-4 text-sm text-error-primary">{error}</p>}

                <div className="mt-8 flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || (postType === "sub_need" ? !validateSubNeed() : !validateRegularGame()) || !dirty}
                        className={PRIMARY_BTN}
                    >
                        {saving ? (
                            <span
                                className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950"
                                aria-hidden="true"
                            />
                        ) : isEditing ? (
                            "Save changes"
                        ) : (
                            "Create post"
                        )}
                    </button>
                    <button type="button" onClick={closeForm} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
                </>
                )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
