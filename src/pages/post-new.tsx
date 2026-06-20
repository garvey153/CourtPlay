import { useEffect, useState } from "react";
import type { DateValue } from "react-aria-components";
import { useNavigate, useSearchParams } from "react-router";
import { parseDate, today, getLocalTimeZone } from "@internationalized/date";
import { Button } from "@/components/base/buttons/button";
import { InputDate } from "@/components/base/input/input-date";
import { InputNumber } from "@/components/base/input/input-number";
import { Input } from "@/components/base/input/input";
import { MultiSelect } from "@/components/base/select/multi-select";
import { Select } from "@/components/base/select/select";
import { SelectItem } from "@/components/base/select/select-item";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { upsertCustomCourt } from "@/lib/custom-court";
import { sendNotificationBatch } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import type { Selection } from "react-aria-components";
import { cx } from "@/utils/cx";

const FORMATS = [
    { id: "point_play", label: "Point play" },
    { id: "clinic", label: "Clinic" },
    { id: "lesson", label: "Lesson" },
    { id: "round_robin", label: "Round robin" },
    { id: "other", label: "Other event" },
];

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

const SKILL_LEVELS = [
    { id: "2.5", label: "2.5" },
    { id: "3.0", label: "3.0" },
    { id: "3.5", label: "3.5" },
    { id: "4.0", label: "4.0" },
    { id: "4.5", label: "4.5" },
    { id: "5.0", label: "5.0" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ id: d, label: d }));
const TIMES_OF_DAY = [
    { id: "Morning", label: "Morning" },
    { id: "Midday", label: "Midday" },
    { id: "Afternoon", label: "Afternoon" },
    { id: "Evening", label: "Evening" },
];

interface Court { id: string; name: string; area: string | null }

export function PostNew() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editPostId = searchParams.get("edit");

    const [postType, setPostType] = useState<"sub_need" | "regular_game">("sub_need");
    const [courts, setCourts] = useState<Court[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitHit, setRateLimitHit] = useState(false);

    // sub_need fields
    const [playType, setPlayType] = useState("");
    const [duration, setDuration] = useState<number | null>(null);
    const [totalPlayers, setTotalPlayers] = useState(4);
    const [gameDate, setGameDate] = useState<DateValue | null>(null);
    const [multiDateMode, setMultiDateMode] = useState(false);
    const [extraDates, setExtraDates] = useState<DateValue[]>([]);
    const [gameTime, setGameTime] = useState("09:00");
    const [skillLevel, setSkillLevel] = useState("");
    const [courtId, setCourtId] = useState<string | null>(null);
    const [showCustomCourt, setShowCustomCourt] = useState(false);
    const [customCourt, setCustomCourt] = useState("");
    const [proName, setProName] = useState("");
    const [cost, setCost] = useState<number | null>(null);
    const [spotsTotal, setSpotsTotal] = useState(1);
    const [notes, setNotes] = useState("");

    // regular_game fields
    const [rgFormats, setRgFormats] = useState<Selection>(new Set());
    const [rgGroupSize, setRgGroupSize] = useState<number | null>(null);
    const [rgSkillLevel, setRgSkillLevel] = useState("");
    const [rgDays, setRgDays] = useState<Selection>(new Set());
    const [rgTimes, setRgTimes] = useState<Selection>(new Set());
    const [rgCourts, setRgCourts] = useState<Selection>(new Set());
    const [rgNote, setRgNote] = useState("");

    // edit mode state
    const [existingClaims, setExistingClaims] = useState(false);
    const [seriesId, setSeriesId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [originalCost, setOriginalCost] = useState<number | null>(null);

    useEffect(() => {
        supabase.from("courts").select("id, name, area").eq("active", true).order("name")
            .then(({ data }) => setCourts(data ?? []));
    }, []);

    // Load post for editing
    useEffect(() => {
        if (!editPostId || !user) return;
        setIsEditing(true);
        Promise.all([
            supabase.from("posts").select("*").eq("id", editPostId).single(),
            supabase.from("claims").select("id").eq("post_id", editPostId).in("status", ["pending", "approved"]).limit(1),
        ]).then(([{ data: post }, { data: claims }]) => {
            if (!post) return;
            setPostType(post.post_type);
            setSeriesId(post.series_id);
            setExistingClaims((claims ?? []).length > 0);
            if (post.post_type === "sub_need") {
                setPlayType(post.play_type ?? "");
                setDuration(post.duration != null ? Number(post.duration) : null);
                setTotalPlayers(post.total_players ?? 4);
                setGameDate(post.game_date ? parseDate(post.game_date) : null);
                setGameTime(post.game_time ? post.game_time.slice(0, 5) : "09:00");
                setSkillLevel(post.skill_level ?? "");
                setCourtId(post.court_id ?? null);
                setCustomCourt(post.custom_court ?? "");
                setShowCustomCourt(!!post.custom_court && !post.court_id);
                setProName(post.pro_name ?? "");
                const postCost = post.cost ? Number(post.cost) : null;
                setCost(postCost);
                setOriginalCost(postCost);
                setSpotsTotal(post.spots_total ?? 1);
                setNotes(post.notes ?? "");
            } else {
                setRgFormats(new Set(post.format ? [post.format] : []));
                setRgGroupSize(post.total_players ?? null);
                setRgSkillLevel(post.skill_level ?? "");
                setRgDays(new Set(post.preferred_days ?? []));
                setRgTimes(new Set(post.preferred_times ?? []));
                setRgCourts(new Set(post.court_preferences ?? []));
                setRgNote(post.notes ?? "");
            }
        });
    }, [editPostId, user]);

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


    const allDates = gameDate
        ? [gameDate, ...extraDates.filter((d) => d.toString() !== gameDate.toString())]
        : [];

    const validateSubNeed = () =>
        playType && gameDate && gameTime && skillLevel && (courtId || customCourt.trim()) && cost !== null;

    const validateRegularGame = () => rgSkillLevel;

    const handleSubmit = async () => {
        if (!user) return;
        setSaving(true);
        setError(null);

        try {
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

                const newSeriesId = allDates.length > 1 ? crypto.randomUUID() : seriesId;
                const datesToInsert = allDates.length > 0 ? allDates : (gameDate ? [gameDate] : []);

                if (isEditing && editPostId) {
                    await supabase.from("posts").update({
                        ...(existingClaims ? {} : {
                            play_type: playType,
                            duration,
                            total_players: totalPlayers,
                            game_date: gameDate?.toString(),
                            game_time: gameTime,
                            skill_level: skillLevel,
                            court_id: courtId,
                            custom_court: usedCustomCourt ? customCourt.trim() : null,
                            location: usedCustomCourt ? customCourt.trim() : courts.find((c) => c.id === courtId)?.name ?? null,
                            pro_name: proName || null,
                            spots_total: spotsTotal,
                        }),
                        cost,
                        notes: notes || null,
                    }).eq("id", editPostId);

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
                    const { data: inserted } = await supabase.from("posts").insert(
                        datesToInsert.map((d) => ({
                            author_id: user.id,
                            post_type: "sub_need",
                            play_type: playType,
                            duration,
                            total_players: totalPlayers,
                            game_date: d.toString(),
                            game_time: gameTime,
                            skill_level: skillLevel,
                            court_id: courtId,
                            custom_court: usedCustomCourt ? customCourt.trim() : null,
                            location: usedCustomCourt ? customCourt.trim() : courts.find((c) => c.id === courtId)?.name ?? null,
                            pro_name: proName || null,
                            cost,
                            spots_total: spotsTotal,
                            notes: notes || null,
                            series_id: datesToInsert.length > 1 ? newSeriesId : null,
                        })),
                    ).select("id");

                    // N13: Friend new post — notify followers (opt-in only)
                    const { data: followers } = await supabase
                        .from("follows")
                        .select("follower_id")
                        .eq("following_id", user.id);

                    if (followers && followers.length > 0 && inserted && inserted.length > 0) {
                        const followerIds = followers.map((f) => f.follower_id);
                        const locationDisplay = usedCustomCourt ? customCourt.trim() : courts.find((c) => c.id === courtId)?.name ?? "";
                        // Get poster name for notification
                        const { data: posterInfo } = await supabase
                            .from("users")
                            .select("first_name")
                            .eq("id", user.id)
                            .single();
                        sendNotificationBatch(followerIds, "friend_new_post", inserted[0].id, {
                            poster_name: posterInfo?.first_name ?? "",
                            post_summary: locationDisplay,
                        });
                    }
                }
            } else {
                const fmtArr = rgFormats instanceof Set ? [...rgFormats as Set<string>] : [];
                const dayArr = rgDays instanceof Set ? [...rgDays as Set<string>] : [];
                const timeArr = rgTimes instanceof Set ? [...rgTimes as Set<string>] : [];
                const courtArr = rgCourts instanceof Set ? [...rgCourts as Set<string>] : [];
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);

                if (isEditing && editPostId) {
                    await supabase.from("posts").update({
                        format: fmtArr[0] ?? null,
                        total_players: rgGroupSize,
                        skill_level: rgSkillLevel,
                        preferred_days: dayArr,
                        preferred_times: timeArr,
                        court_preferences: courtArr,
                        notes: rgNote || null,
                    }).eq("id", editPostId);
                } else {
                    await supabase.from("posts").insert({
                        author_id: user.id,
                        post_type: "regular_game",
                        format: fmtArr[0] ?? null,
                        total_players: rgGroupSize,
                        skill_level: rgSkillLevel,
                        preferred_days: dayArr,
                        preferred_times: timeArr,
                        court_preferences: courtArr,
                        notes: rgNote || null,
                        expires_at: expiresAt.toISOString(),
                    });
                }
            }

            // Flag first post creation for push prompt on feed page
            if (!isEditing) {
                localStorage.setItem("courtsub_show_push_prompt", "post_created");
            }
            navigate("/feed");
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
            <div className="mx-auto max-w-lg px-4 py-6">
                <h1 className="mb-1 text-xl font-semibold text-primary">
                    {isEditing ? "Edit post" : "New post"}
                </h1>
                <p className="mb-5 text-sm text-tertiary">
                    {isEditing ? "Update your post details." : "Let the group know you need a sub or a regular game."}
                </p>

                {/* Post type toggle — hidden in edit mode */}
                {!isEditing && (
                    <div className="mb-6 flex rounded-lg border border-secondary p-1">
                        {(["sub_need", "regular_game"] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setPostType(t)}
                                className={cx(
                                    "flex-1 rounded-md py-2 text-sm font-semibold transition-colors",
                                    postType === t
                                        ? "bg-brand-solid text-white"
                                        : "text-tertiary hover:text-secondary",
                                )}
                            >
                                {t === "sub_need" ? "Find a Sub" : "Regular Game"}
                            </button>
                        ))}
                    </div>
                )}

                {rateLimitHit && (
                    <p className="mb-4 rounded-lg bg-warning-primary px-3 py-2 text-sm text-warning-primary">
                        You already have 5 active posts. Close one before posting again.
                    </p>
                )}

                {/* ── Sub need form ── */}
                {postType === "sub_need" && (
                    <div className="flex flex-col gap-5">
                        <Select
                            label="Play type"
                            placeholder="Select play type"
                            items={PLAY_TYPES}
                            selectedKey={playType || null}
                            onSelectionChange={(k) => setPlayType(k as string)}
                            isRequired
                            isDisabled={lockedField}
                            tooltip={lockedField ? lockedTitle : undefined}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>

                        <Select
                            label="Duration (optional)"
                            placeholder="Select duration"
                            items={DURATIONS}
                            selectedKey={duration != null ? String(duration) : null}
                            onSelectionChange={(k) => setDuration(k != null ? Number(k) : null)}
                            isDisabled={lockedField}
                            tooltip={lockedField ? lockedTitle : undefined}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>

                        <InputNumber
                            label="Total players"
                            minValue={2}
                            maxValue={20}
                            value={totalPlayers}
                            onChange={(v) => setTotalPlayers(v)}
                            isRequired
                            isDisabled={lockedField}
                        />

                        {/* Date(s) */}
                        <div className="flex flex-col gap-2">
                            <InputDate
                                label="Game date"
                                value={gameDate}
                                onChange={(v) => setGameDate(v)}
                                minValue={today(getLocalTimeZone())}
                                isRequired
                                isDisabled={lockedField}
                            />
                            {!lockedField && (
                                <Toggle size="sm" isSelected={multiDateMode} onChange={setMultiDateMode}>
                                    Multi-date series
                                </Toggle>
                            )}
                            {multiDateMode && !lockedField && (
                                <div className="flex flex-col gap-2">
                                    {extraDates.map((d, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <InputDate
                                                    label={`Date ${i + 2}`}
                                                    value={d}
                                                    onChange={(v) => {
                                                        const next = [...extraDates];
                                                        next[i] = v!;
                                                        setExtraDates(next);
                                                    }}
                                                    minValue={today(getLocalTimeZone())}
                                                />
                                            </div>
                                            <button
                                                onClick={() => setExtraDates(extraDates.filter((_, j) => j !== i))}
                                                className="mt-5 text-sm text-tertiary hover:text-primary"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    <Button
                                        color="secondary"
                                        size="sm"
                                        className="self-start"
                                        onClick={() => setExtraDates([...extraDates, today(getLocalTimeZone())])}
                                    >
                                        + Add date
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Time */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-secondary">
                                Game time <span className="text-error-primary">*</span>
                            </label>
                            <input
                                type="time"
                                value={gameTime}
                                onChange={(e) => setGameTime(e.target.value)}
                                disabled={lockedField}
                                className="h-10 rounded-lg border border-primary px-3 text-sm text-primary shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-solid disabled:opacity-50"
                            />
                        </div>

                        <Select
                            label="Skill level required"
                            placeholder="Select level"
                            items={SKILL_LEVELS}
                            selectedKey={skillLevel || null}
                            onSelectionChange={(k) => setSkillLevel(k as string)}
                            isRequired
                            isDisabled={lockedField}
                            tooltip={lockedField ? lockedTitle : undefined}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>

                        {/* Court selection */}
                        {!showCustomCourt ? (
                            <Select
                                label="Location / court"
                                placeholder="Search courts…"
                                items={courtItems}
                                selectedKey={courtId}
                                onSelectionChange={(k) => handleCourtSelect(k as string)}
                                isRequired
                                isDisabled={lockedField}
                                tooltip={lockedField ? lockedTitle : undefined}
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
                                />
                                <button
                                    onClick={() => { setShowCustomCourt(false); setCustomCourt(""); }}
                                    className="self-start text-sm text-brand-secondary"
                                >
                                    ← Back to court list
                                </button>
                            </div>
                        )}

                        <Input
                            label="Pro name (optional)"
                            placeholder="e.g. Mike at Longshore"
                            value={proName}
                            onChange={(v) => setProName(v)}
                            isDisabled={lockedField}
                        />

                        {/* Cost */}
                        <InputNumber
                            label="Cost per sub ($)"
                            minValue={0}
                            formatOptions={{ style: "decimal", minimumFractionDigits: 0, maximumFractionDigits: 2 }}
                            value={cost ?? undefined}
                            onChange={(v) => setCost(isNaN(v) ? null : v)}
                            isRequired
                        />

                        {/* Spots */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-secondary">
                                Spots open <span className="text-error-primary">*</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSpotsTotal((s) => Math.max(1, s - 1))}
                                    disabled={lockedField || spotsTotal <= 1}
                                    className="flex size-9 items-center justify-center rounded-lg border border-secondary text-lg font-semibold text-primary hover:bg-primary_hover disabled:opacity-40"
                                >
                                    −
                                </button>
                                <span className="w-6 text-center font-semibold text-primary">{spotsTotal}</span>
                                <button
                                    onClick={() => setSpotsTotal((s) => Math.min(8, s + 1))}
                                    disabled={lockedField || spotsTotal >= 8}
                                    className="flex size-9 items-center justify-center rounded-lg border border-secondary text-lg font-semibold text-primary hover:bg-primary_hover disabled:opacity-40"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <TextArea
                            label="Notes (optional)"
                            placeholder="Anything else the sub should know…"
                            value={notes}
                            onChange={(v) => setNotes(v)}
                            maxLength={100}
                            hint={`${notes.length}/100`}
                            rows={3}
                        />
                    </div>
                )}

                {/* ── Regular game form ── */}
                {postType === "regular_game" && (
                    <div className="flex flex-col gap-5">
                        <MultiSelect
                            label="Format(s)"
                            placeholder="Select format(s)"
                            items={FORMATS}
                            selectedKeys={rgFormats}
                            onSelectionChange={(k) => setRgFormats(k)}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </MultiSelect>

                        <InputNumber
                            label="Preferred group size (optional)"
                            minValue={2}
                            maxValue={20}
                            value={rgGroupSize ?? undefined}
                            onChange={(v) => setRgGroupSize(isNaN(v) ? null : v)}
                        />

                        <Select
                            label="Skill level"
                            placeholder="Select level"
                            items={SKILL_LEVELS}
                            selectedKey={rgSkillLevel || null}
                            onSelectionChange={(k) => setRgSkillLevel(k as string)}
                            isRequired
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </Select>

                        <MultiSelect
                            label="Preferred days"
                            placeholder="Any day"
                            items={DAYS}
                            selectedKeys={rgDays}
                            onSelectionChange={(k) => setRgDays(k)}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </MultiSelect>

                        <MultiSelect
                            label="Preferred times"
                            placeholder="Any time"
                            items={TIMES_OF_DAY}
                            selectedKeys={rgTimes}
                            onSelectionChange={(k) => setRgTimes(k)}
                        >
                            {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                        </MultiSelect>

                        <MultiSelect
                            label="Preferred courts (optional)"
                            placeholder="Any court"
                            items={courts.map((c) => ({ id: c.id, label: c.name, supportingText: c.area ?? undefined }))}
                            selectedKeys={rgCourts}
                            onSelectionChange={(k) => setRgCourts(k)}
                        >
                            {(item) => <SelectItem id={item.id} supportingText={item.supportingText}>{item.label}</SelectItem>}
                        </MultiSelect>

                        <TextArea
                            label="Brief note (optional)"
                            placeholder="Tell the group what you're looking for…"
                            value={rgNote}
                            onChange={(v) => setRgNote(v)}
                            maxLength={150}
                            hint={`${rgNote.length}/150`}
                            rows={3}
                        />
                    </div>
                )}

                {error && <p className="mt-4 text-sm text-error-primary">{error}</p>}

                <div className="mt-8 flex gap-3">
                    <Button color="secondary" size="lg" className="flex-1" onClick={() => navigate(-1)}>
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        size="lg"
                        className="flex-1"
                        isLoading={saving}
                        showTextWhileLoading
                        isDisabled={postType === "sub_need" ? !validateSubNeed() : !validateRegularGame()}
                        onClick={handleSubmit}
                    >
                        {isEditing ? "Save changes" : allDates.length > 1 ? `Post ${allDates.length} dates` : "Post"}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
