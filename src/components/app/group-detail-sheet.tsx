import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Check, SearchSm, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Input } from "@/components/base/input/input";
import { FIELD } from "@/components/base/input/field-styles";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { LoadingState, Spinner } from "@/components/application/loading-indicator/spinner";
import { ErrorState } from "@/components/application/loading-indicator/area-state";
import { supabase } from "@/lib/supabase";
import { describeActionError } from "@/utils/load-error";
import { cx } from "@/utils/cx";
import type { GroupDetail, GroupMember } from "@/types/groups";

interface GroupDetailSheetProps {
    groupId: string;
    onClose: () => void;
    /** Refetch the list after anything that changes membership. */
    onChanged: () => void;
}

interface SearchResult {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    skill_level: string | null;
}

type View = "roster" | "invite" | "confirm-leave";

/**
 * A group's roster, with invite and leave.
 *
 * Views are local state rather than routes, matching regular-connections-sheet:
 * the whole thing is one bottom sheet and backing out of Invite should return to
 * the roster, not to the page behind it.
 */
export function GroupDetailSheet({ groupId, onClose, onChanged }: GroupDetailSheetProps) {
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [view, setView] = useState<View>("roster");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [invited, setInvited] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        const { data, error: rpcError } = await supabase.rpc("get_group", { p_group_id: groupId });
        setLoading(false);
        if (rpcError) {
            console.error("get_group failed:", rpcError);
            setLoadError(rpcError);
            return;
        }
        // null means the caller lost access — treat it as gone rather than empty.
        setGroup((data as GroupDetail | null) ?? null);
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

    // Debounced people search, mirroring the profile page's follow search.
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (timer.current) clearTimeout(timer.current);
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        setSearching(true);
        timer.current = setTimeout(async () => {
            const { data } = await supabase.rpc("search_users", { p_query: q });
            setResults((data as SearchResult[]) ?? []);
            setSearching(false);
        }, 300);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [query]);

    const memberIds = useMemo(() => new Set((group?.members ?? []).map((m) => m.id)), [group]);

    const handleInvite = async (userId: string) => {
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("invite_to_group", {
            p_group_id: groupId,
            p_user_id: userId,
        });
        if (rpcError || !data?.success) {
            console.error("invite_to_group failed:", rpcError ?? data);
            setError(data?.error ?? describeActionError(rpcError, "send that invite"));
            return;
        }
        setInvited((s) => new Set(s).add(userId));
        load();
        onChanged();
    };

    const handleLeave = async () => {
        setBusy(true);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("leave_group", { p_group_id: groupId });
        setBusy(false);
        if (rpcError || !data?.success) {
            console.error("leave_group failed:", rpcError ?? data);
            setError(data?.error ?? describeActionError(rpcError, "leave that group"));
            return;
        }
        onChanged();
        onClose();
    };

    const handleRemove = async (userId: string) => {
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("remove_group_member", {
            p_group_id: groupId,
            p_user_id: userId,
        });
        if (rpcError || !data?.success) {
            console.error("remove_group_member failed:", rpcError ?? data);
            setError(data?.error ?? describeActionError(rpcError, "remove that player"));
            return;
        }
        load();
        onChanged();
    };

    const isOwner = group?.my_role === "owner";
    const title = view === "invite" ? "Add players" : view === "confirm-leave" ? "Leave group?" : (group?.name ?? "Group");

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-detail-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        {view !== "roster" && (
                            <button
                                type="button"
                                onClick={() => setView("roster")}
                                aria-label="Back"
                                className="-ml-1 shrink-0 rounded-lg p-1 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                            >
                                <ArrowLeft className="size-5" />
                            </button>
                        )}
                        <h2 id="group-detail-title" className="truncate text-md font-semibold text-primary">
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                    >
                        <XClose className="size-5" strokeWidth={1} />
                    </button>
                </div>

                {loading && <LoadingState variant="block" label="Loading group" />}
                {/* !! because loadError is `unknown` — bare && widens the JSX expression to unknown. */}
                {!loading && !!loadError && <ErrorState variant="block" error={loadError} subject="that group" onRetry={load} />}
                {!loading && !loadError && !group && (
                    <p className="py-8 text-center text-sm text-tertiary">
                        This group is no longer available.
                    </p>
                )}

                {!loading && group && view === "roster" && (
                    <>
                        <p className="text-sm text-tertiary">
                            {group.members.filter((m) => m.status === "active").length} player
                            {group.members.filter((m) => m.status === "active").length === 1 ? "" : "s"}
                        </p>
                        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
                            {group.members.map((m) => (
                                <MemberRow
                                    key={m.id}
                                    member={m}
                                    canRemove={isOwner && m.role !== "owner"}
                                    onRemove={() => handleRemove(m.id)}
                                />
                            ))}
                        </ul>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                        <div className="mt-2 flex flex-col gap-3">
                            <button type="button" onClick={() => setView("invite")} className={PRIMARY_BTN}>
                                Add players
                            </button>
                            <button type="button" onClick={() => setView("confirm-leave")} className={SECONDARY_BTN}>
                                Leave group
                            </button>
                        </div>
                    </>
                )}

                {!loading && group && view === "invite" && (
                    <>
                        <Input
                            icon={SearchSm}
                            placeholder="Search players"
                            value={query}
                            onChange={setQuery}
                            size="sm"
                            aria-label="Search players"
                            wrapperClassName={FIELD}
                        />
                        {searching && <LoadingState variant="block" className="py-6" label="Searching" />}
                        {!searching && query.trim().length >= 2 && results.length === 0 && (
                            <p className="py-6 text-center text-sm text-tertiary">No players match that.</p>
                        )}
                        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
                            {results.map((r) => {
                                const already = memberIds.has(r.id) || invited.has(r.id);
                                return (
                                    <li key={r.id}>
                                        <button
                                            type="button"
                                            disabled={already}
                                            onClick={() => handleInvite(r.id)}
                                            className="flex w-full items-center gap-3 rounded-lg border border-neutral-600 px-3 py-2.5 text-left transition duration-100 ease-linear enabled:hover:bg-secondary_hover disabled:opacity-50"
                                        >
                                            <Avatar
                                                size="sm"
                                                src={r.photo_url ?? undefined}
                                                alt={r.first_name}
                                                initials={r.first_name.charAt(0).toUpperCase()}
                                                className="shrink-0 bg-white p-px shadow-xs"
                                            />
                                            <span className="min-w-0 flex-1 truncate text-sm text-primary">
                                                {r.first_name} {r.last_name?.charAt(0) ?? ""}
                                            </span>
                                            <span className="shrink-0 text-xs text-tertiary">
                                                {already ? <Check className="size-4" aria-label="Invited" /> : "Invite"}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                    </>
                )}

                {!loading && group && view === "confirm-leave" && (
                    <>
                        <p className="text-sm text-tertiary">
                            {isOwner
                                ? "You're the owner. The longest-standing player takes over, or the group closes if you're the last one in it."
                                : `You'll drop out of ${group.name} and stop seeing posts shared with it.`}
                        </p>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                        <div className="mt-2 flex flex-col gap-3">
                            <button type="button" onClick={handleLeave} disabled={busy} className={PRIMARY_BTN}>
                                {busy ? <Spinner size="sm" tone="on-brand" /> : "Leave group"}
                            </button>
                            <button type="button" onClick={() => setView("roster")} disabled={busy} className={SECONDARY_BTN}>
                                Stay
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}

function MemberRow({ member, canRemove, onRemove }: { member: GroupMember; canRemove: boolean; onRemove: () => void }) {
    return (
        <li className="flex items-center gap-3 rounded-lg border border-neutral-600 px-3 py-2.5">
            <Avatar
                size="sm"
                src={member.photo_url ?? undefined}
                alt={member.first_name}
                initials={member.first_name.charAt(0).toUpperCase()}
                className="shrink-0 bg-white p-px shadow-xs"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-primary">
                {member.first_name} {member.last_name?.charAt(0) ?? ""}
                {member.role === "owner" && <span className="ml-2 text-xs text-tertiary">Owner</span>}
            </span>
            {member.status === "invited" && <span className="shrink-0 text-xs text-tertiary">Invited</span>}
            {canRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className={cx("shrink-0 text-xs text-tertiary transition duration-100 ease-linear hover:text-primary")}
                >
                    Remove
                </button>
            )}
        </li>
    );
}
