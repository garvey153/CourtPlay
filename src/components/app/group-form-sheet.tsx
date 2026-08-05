import { useCallback, useEffect, useRef, useState } from "react";
import { SearchSm, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Input } from "@/components/base/input/input";
import { FIELD } from "@/components/base/input/field-styles";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { LoadingState, Spinner } from "@/components/application/loading-indicator/spinner";
import { ErrorState } from "@/components/application/loading-indicator/area-state";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import { describeActionError } from "@/utils/load-error";
import { skillLabel } from "@/utils/skill-label";
import type { GroupDetail, GroupMemberBrief } from "@/types/groups";

interface GroupFormSheetProps {
    /**
     * Omit to create; pass an id to edit. The group is loaded here rather than
     * by the caller so tapping through from Profile opens the screen straight
     * away instead of waiting on a fetch first.
     */
    groupId?: string;
    onClose: () => void;
    /** Fired after a successful save, with the group's id. */
    onSaved: (groupId: string) => void;
}

interface Candidate extends GroupMemberBrief {
    skill_level: string | null;
}

/**
 * Create and edit share one screen (Figma 590:6475 / 593:7390) — the layout is
 * identical and only the title and primary label differ.
 *
 * The creator heads the member list but is not removable: they are always a
 * member, and the RPC forces them back in regardless of what is submitted, so
 * offering to remove them would be a lie. `members` therefore holds only the
 * editable members; the creator is rendered separately.
 */
export function GroupFormSheet({ groupId, onClose, onSaved }: GroupFormSheetProps) {
    const editing = !!groupId;
    const { profile } = useProfile();

    const [loading, setLoading] = useState(editing);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [creator, setCreator] = useState<Candidate | null>(null);
    /** Membership as loaded, so save() can diff against it. Empty when creating. */
    const initialMemberIds = useRef<string[]>([]);

    const [name, setName] = useState("");
    const [details, setDetails] = useState("");
    const [members, setMembers] = useState<Candidate[]>([]);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Candidate[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Creating: the caller is the creator, and their own profile is already in
    // memory, so the row can render before anything is saved.
    useEffect(() => {
        if (editing || !profile) return;
        setCreator({
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            photo_url: profile.photo_url,
            skill_level: profile.skill_level,
        });
    }, [editing, profile]);

    const load = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        setLoadError(null);
        const { data, error: rpcError } = await supabase.rpc("get_group", { p_group_id: groupId });
        setLoading(false);
        if (rpcError || !data) {
            console.error("get_group failed:", rpcError ?? "no access");
            setLoadError(rpcError ?? new Error("Group unavailable"));
            return;
        }
        const g = data as GroupDetail;
        const editable = g.members.filter((m) => !m.is_creator);
        setName(g.name);
        setDetails(g.details ?? "");
        setCreator(g.members.find((m) => m.is_creator) ?? null);
        setMembers(editable.map((m) => ({ ...m })));
        // Baseline for the notification diff. A ref, not state: it must survive
        // every edit the user makes and never trigger a re-render.
        initialMemberIds.current = editable.map((m) => m.id);
    }, [groupId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    // Debounced player search, matching the Profile follow search.
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (timer.current) clearTimeout(timer.current);
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        timer.current = setTimeout(async () => {
            const { data } = await supabase.rpc("search_users", { p_query: q });
            setResults(Array.isArray(data) ? (data as Candidate[]) : []);
            setSearchLoading(false);
        }, 300);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [query]);

    const add = (c: Candidate) => {
        setMembers((m) => (m.some((x) => x.id === c.id) ? m : [...m, c]));
        setQuery("");
        setResults([]);
    };

    const save = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setSaving(true);
        setError(null);

        const ids = members.map((m) => m.id);
        const { data, error: rpcError } = editing
            ? await supabase.rpc("update_group", {
                  p_group_id: groupId,
                  p_name: trimmed,
                  p_details: details.trim() || null,
                  p_member_ids: ids,
              })
            : await supabase.rpc("create_group", {
                  p_name: trimmed,
                  p_details: details.trim() || null,
                  p_member_ids: ids,
              });
        setSaving(false);

        // The RPCs report refusals in the payload rather than throwing, so a
        // successful call with success:false still has to surface — this is
        // where the duplicate-group message lands.
        if (rpcError || !data?.success) {
            console.error("group save failed:", rpcError ?? data);
            setError(data?.error ?? describeActionError(rpcError, editing ? "save that group" : "create that group"));
            return;
        }

        // Tell the people whose membership actually changed. The diff is
        // computed here because the RPC returns only success — and it is a diff
        // rather than "everyone currently in the group", so re-saving a group
        // without touching its members notifies nobody.
        const savedId = (data.group_id as string) ?? groupId!;
        const before = new Set(initialMemberIds.current);
        const after = new Set(ids);
        for (const id of after) {
            if (!before.has(id)) sendNotification({ notification_type: "group_added", group_id: savedId, target_user_id: id });
        }
        for (const id of before) {
            if (!after.has(id)) sendNotification({ notification_type: "group_removed", group_id: savedId, target_user_id: id });
        }

        onSaved(savedId);
    };

    // Same threshold as Profile's follow search: below two characters the
    // member list stays put rather than flickering on every keystroke.
    const isSearching = query.trim().length >= 2;

    const alreadyIn = (id: string) => members.some((m) => m.id === id) || creator?.id === id;

    return (
        <div className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-labelledby="group-form-title">
            {/* Full-page modal, matching Create Post (590:6475). The inset-top padding
                sits on this container rather than the header: the close button is
                absolutely positioned against the header's border box, so padding the
                header alone would push the title down and leave the button under the
                status bar. */}
            <div className="flex w-full max-w-lg flex-col overflow-hidden bg-secondary pt-[env(safe-area-inset-top)] shadow-xl">
                <div className="relative shrink-0 px-5 pt-[18px] pb-5">
                    <h1 id="group-form-title" className="pr-9 text-lg font-semibold text-primary">
                        {editing ? "Edit group" : "Create group"}
                    </h1>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" />
                    </button>
                </div>

                {loading && <LoadingState variant="fill" label="Loading group" />}
                {/* !! because loadError is `unknown` — a bare && widens the JSX to unknown. */}
                {!loading && !!loadError && (
                    <ErrorState variant="fill" error={loadError} subject="that group" onRetry={load} />
                )}

                {/* 24px between fields per the design's Content gap. */}
                {!loading && !loadError && (
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6">
                    <Input
                        label="Group name"
                        placeholder="e.g. The Racquettes"
                        value={name}
                        onChange={setName}
                        size="sm"
                        isRequired
                        wrapperClassName={FIELD}
                    />
                    <Input
                        label="Group details"
                        placeholder="e.g. Westport Social League"
                        value={details}
                        onChange={setDetails}
                        size="sm"
                        wrapperClassName={FIELD}
                    />

                    <div className="flex flex-col gap-2">
                        <label htmlFor="group-member-search" className="text-sm font-medium text-secondary">
                            Group members
                        </label>

                        {/* Hand-rolled rather than the base Input, which has no trailing
                            slot for the clear button. Filled variant: this sits on
                            bg-secondary inside the modal, the lighter elevated surface. */}
                        <div className="flex h-9 items-center gap-2 rounded-lg bg-tertiary px-3 shadow-xs ring-1 ring-neutral-600">
                            <SearchSm className="size-5 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
                            <input
                                id="group-member-search"
                                className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                                placeholder="Search players"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoComplete="off"
                            />
                            {query && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => setQuery("")}
                                    className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-primary"
                                >
                                    <XClose className="size-5" strokeWidth={1} />
                                </button>
                            )}
                        </div>

                        {/* 26px from the field to the first row. The container's gap-2 and
                            the rows' py-2 both eat into that, so the margin here is the
                            remainder rather than the whole distance — measured, not
                            derived from the class name.

                            Searching REPLACES the member list rather than stacking above
                            it, matching Profile's follow search — otherwise the same
                            person can appear twice, once as a result and once as a
                            member, and it is unclear which list a tap acts on. */}
                        <div className="mt-[10px]">
                        {isSearching ? (
                            searchLoading ? (
                                <p className="py-1 text-sm text-tertiary">Searching…</p>
                            ) : results.length === 0 ? (
                                <p className="py-1 text-sm text-tertiary">No players match that.</p>
                            ) : (
                                <ul className="flex flex-col gap-1">
                                    {results.map((r) => (
                                        <li key={r.id}>
                                            <button
                                                type="button"
                                                disabled={alreadyIn(r.id)}
                                                onClick={() => add(r)}
                                                className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition duration-100 ease-linear enabled:hover:bg-secondary_hover disabled:opacity-50"
                                            >
                                                <MemberAvatar member={r} />
                                                <span className="min-w-0 flex-1 truncate text-sm text-secondary">
                                                    {nameOf(r)}
                                                    {r.skill_level && ` · ${skillLabel(r.skill_level)}`}
                                                </span>
                                                <span className="shrink-0 text-sm text-brand-500">
                                                    {alreadyIn(r.id) ? "Added" : "Add"}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )
                        ) : (
                            /* The creator heads the list and is labelled rather than
                               removable — the RPC puts them back regardless, so a Remove
                               link would do nothing. */
                            <ul className="flex flex-col gap-1">
                                {creator && (
                                    <li className="flex items-center gap-3 px-1 py-2">
                                        <MemberAvatar member={creator} />
                                        <span className="min-w-0 flex-1 truncate text-sm text-secondary">
                                            {nameOf(creator)}
                                            {creator.skill_level && ` · ${skillLabel(creator.skill_level)}`}
                                        </span>
                                        {/* Tertiary, not brand: the Remove links beside it are
                                            actions, and Owner is a label. Green would read as
                                            something you could tap. */}
                                        <span className="shrink-0 text-sm text-tertiary">Owner</span>
                                    </li>
                                )}
                                {members.map((m) => (
                                    <li key={m.id} className="flex items-center gap-3 px-1 py-2">
                                        <MemberAvatar member={m} />
                                        <span className="min-w-0 flex-1 truncate text-sm text-secondary">
                                            {nameOf(m)}
                                            {m.skill_level && ` · ${skillLabel(m.skill_level)}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setMembers((list) => list.filter((x) => x.id !== m.id))}
                                            className="shrink-0 text-sm text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        </div>
                    </div>
                </div>
                )}

                {/* Pinned footer, so the actions stay reachable however long the member
                    list grows. pb carries the home-indicator inset — the buttons are the
                    last thing on screen, so nothing else reserves that space. */}
                <div className="shrink-0 px-5 pt-2 pb-[calc(1.5rem_+_var(--safe-bottom))]">
                    {error && <p className="mb-3 text-sm text-error-primary">{error}</p>}
                    <div className="flex flex-col gap-3">
                        <button type="button" onClick={save} disabled={saving || !name.trim()} className={PRIMARY_BTN}>
                            {saving ? <Spinner size="sm" tone="on-brand" /> : editing ? "Save changes" : "Create group"}
                        </button>
                        <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function nameOf(m: GroupMemberBrief): string {
    return `${m.first_name}${m.last_name ? ` ${m.last_name.charAt(0)}.` : ""}`;
}

function MemberAvatar({ member }: { member: GroupMemberBrief }) {
    return (
        <Avatar
            size="sm"
            src={member.photo_url ?? undefined}
            alt={member.first_name}
            initials={member.first_name.charAt(0).toUpperCase()}
            className="shrink-0 bg-white p-px shadow-xs"
        />
    );
}
