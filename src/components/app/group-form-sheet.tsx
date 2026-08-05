import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { SearchSm, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Input } from "@/components/base/input/input";
import { FIELD } from "@/components/base/input/field-styles";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import { describeActionError } from "@/utils/load-error";
import { skillLabel } from "@/utils/skill-label";
import type { GroupDetail, GroupMemberBrief } from "@/types/groups";

interface GroupFormSheetProps {
    /** Omit to create; pass a group to edit it. */
    group?: GroupDetail;
    onClose: () => void;
    /** Fired after a successful save, with the group's id. */
    onSaved: (groupId: string) => void;
}

interface Candidate extends GroupMemberBrief {
    skill_level: string | null;
}

/**
 * Create and edit share one sheet (Figma 590:6475 / 593:7390) — the layout is
 * identical and only the title and primary label differ.
 *
 * The creator is never listed or removable: they are always a member, and the
 * RPC forces them back in regardless of what is submitted, so showing them as a
 * removable row would be a lie.
 */
export function GroupFormSheet({ group, onClose, onSaved }: GroupFormSheetProps) {
    const editing = !!group;

    const [name, setName] = useState(group?.name ?? "");
    const [details, setDetails] = useState(group?.details ?? "");
    const [members, setMembers] = useState<Candidate[]>(
        () => (group?.members ?? []).filter((m) => !m.is_creator).map((m) => ({ ...m })),
    );

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Candidate[]>([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            setSearching(false);
            return;
        }
        setSearching(true);
        timer.current = setTimeout(async () => {
            const { data } = await supabase.rpc("search_users", { p_query: q });
            setResults(Array.isArray(data) ? (data as Candidate[]) : []);
            setSearching(false);
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
                  p_group_id: group.id,
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
        const groupId = (data.group_id as string) ?? group!.id;
        const before = new Set((group?.members ?? []).filter((m) => !m.is_creator).map((m) => m.id));
        const after = new Set(ids);
        for (const id of after) {
            if (!before.has(id)) sendNotification({ notification_type: "group_added", group_id: groupId, target_user_id: id });
        }
        for (const id of before) {
            if (!after.has(id)) sendNotification({ notification_type: "group_removed", group_id: groupId, target_user_id: id });
        }

        onSaved(groupId);
    };

    const alreadyIn = (id: string) => members.some((m) => m.id === id) || group?.members.some((m) => m.id === id && m.is_creator);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-form-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex max-h-[90vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="group-form-title" className="text-md font-semibold text-primary">
                        {editing ? "Edit group" : "Create group"}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" strokeWidth={1} />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
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
                        <Input
                            label="Group members"
                            icon={SearchSm}
                            placeholder="Search players"
                            value={query}
                            onChange={setQuery}
                            size="sm"
                            wrapperClassName={FIELD}
                        />

                        {searching && <p className="text-sm text-tertiary">Searching…</p>}
                        {!searching && query.trim().length >= 2 && results.length === 0 && (
                            <p className="text-sm text-tertiary">No players match that.</p>
                        )}

                        {results.length > 0 && (
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
                                            <span className="shrink-0 text-sm font-semibold text-brand-secondary">
                                                {alreadyIn(r.id) ? "Added" : "Add"}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <ul className="flex flex-col gap-1">
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
                                        className="shrink-0 text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-primary"
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {error && <p className="text-sm text-error-primary">{error}</p>}

                <div className="flex flex-col gap-3">
                    <button type="button" onClick={save} disabled={saving || !name.trim()} className={PRIMARY_BTN}>
                        {saving ? <Spinner size="sm" tone="on-brand" /> : editing ? "Save changes" : "Create group"}
                    </button>
                    <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </motion.div>
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
