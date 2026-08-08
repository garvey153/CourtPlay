import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { SearchSm, XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { ErrorState } from "@/components/application/loading-indicator/area-state";
import { describeActionError } from "@/utils/load-error";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import type { AdminGroupRow } from "./admin-group-card";

interface Member {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    skill_level: string | null;
    is_creator: boolean;
}

interface Candidate {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    skill_level: string | null;
}

interface AdminGroupSheetProps {
    group: AdminGroupRow;
    onClose: () => void;
    /** Refetch the list — membership and deletion both change what it shows. */
    onSaved: () => void;
}

const nameOf = (m: { first_name: string; last_name: string | null }) =>
    `${m.first_name}${m.last_name ? ` ${m.last_name.charAt(0)}.` : ""}`;

/**
 * Admin view of one group: the full roster, add and remove, and delete.
 *
 * Every mutation goes through an `admin_*` RPC rather than a direct table write.
 * The group tables have SELECT-only RLS policies and (since 20260809000000) no
 * write grants either, so a `supabase.from().update()` here would silently
 * affect nothing — which is the failure mode the Courts sheet's direct-write
 * style would have walked into.
 */
export function AdminGroupSheet({ group, onClose, onSaved }: AdminGroupSheetProps) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Candidate[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_get_group", { p_group_id: group.id });
        if (rpcError || !data) {
            setLoadError(rpcError ?? new Error("Group not found"));
            setLoading(false);
            return;
        }
        setMembers(Array.isArray(data.members) ? (data.members as Member[]) : []);
        setLoading(false);
    }, [group.id]);

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

    // Debounced player search, the same shape as the group form sheet's.
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

    const add = async (c: Candidate) => {
        setBusy(c.id);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_add_group_member", {
            p_group_id: group.id,
            p_user_id: c.id,
        });
        setBusy(null);
        if (rpcError || data?.success === false) {
            setError(data?.error ?? describeActionError(rpcError, "add that player"));
            return;
        }
        // Same notification the creator's own add sends — the resolver allows an
        // admin acting through this tab, so no server change was needed.
        sendNotification({ notification_type: "group_added", group_id: group.id, target_user_id: c.id });
        setQuery("");
        setResults([]);
        await load();
        onSaved();
    };

    const remove = async (m: Member) => {
        setBusy(m.id);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_remove_group_member", {
            p_group_id: group.id,
            p_user_id: m.id,
        });
        setBusy(null);
        if (rpcError || data?.success === false) {
            setError(data?.error ?? describeActionError(rpcError, "remove that player"));
            return;
        }
        sendNotification({ notification_type: "group_removed", group_id: group.id, target_user_id: m.id });
        // Removing the last member deletes the group, so there is nothing left
        // to show — close rather than reload into an empty sheet.
        if (data?.group_emptied) {
            onSaved();
            onClose();
            return;
        }
        await load();
        onSaved();
    };

    const destroy = async () => {
        setBusy("delete");
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_delete_group", { p_group_id: group.id });
        setBusy(null);
        if (rpcError || data?.success === false) {
            setError(data?.error ?? describeActionError(rpcError, "delete that group"));
            return;
        }
        // Everyone still in it is told, matching what closing does for a creator.
        members.filter((m) => !m.is_creator).forEach((m) =>
            sendNotification({ notification_type: "group_removed", group_id: group.id, target_user_id: m.id }),
        );
        onSaved();
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-group-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-3 z-10 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" strokeWidth={1} />
                </button>

                <div className="flex min-w-0 flex-col gap-1 pr-8">
                    <h2 id="admin-group-sheet-title" className="text-md font-semibold text-primary">
                        {confirming ? "Delete this group?" : group.name}
                    </h2>
                    <p className="text-sm text-tertiary">
                        {confirming
                            ? "The group disappears for everyone in it, and any private post shared with it stops being visible to them."
                            : [group.creator_name, group.details].filter(Boolean).join(" · ")}
                    </p>
                </div>

                {loading && (
                    <div className="flex justify-center py-8">
                        <Spinner />
                    </div>
                )}

                {!loading && !!loadError && (
                    <ErrorState variant="block" error={loadError} subject="that group" onRetry={load} />
                )}

                {!loading && !loadError && !confirming && (
                    <>
                        <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                            {members.map((m) => (
                                <li key={m.id} className="flex items-center gap-3 px-1 py-2">
                                    <Avatar
                                        size="sm"
                                        src={m.photo_url ?? undefined}
                                        alt={m.first_name}
                                        initials={m.first_name.charAt(0).toUpperCase()}
                                        className="shrink-0 bg-white p-px shadow-xs"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm text-secondary">{nameOf(m)}</span>
                                    {m.is_creator ? (
                                        // Tertiary, not brand: Owner is a label, and green
                                        // would read as something you could tap (#133).
                                        <span className="shrink-0 text-sm text-tertiary">Owner</span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => remove(m)}
                                            disabled={busy === m.id}
                                            className="shrink-0 text-sm text-error-primary transition duration-100 ease-linear hover:opacity-80 disabled:opacity-50"
                                        >
                                            {busy === m.id ? "Removing…" : "Remove"}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>

                        {/* Add a player — same debounced search_users as the creator's form. */}
                        <div className="flex flex-col gap-2">
                            <div className="flex h-9 items-center gap-2 rounded-lg border border-neutral-700 px-3 shadow-xs">
                                <SearchSm className="size-5 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Add a player"
                                    aria-label="Add a player"
                                    className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                                />
                                {searchLoading && <Spinner size="sm" />}
                            </div>
                            {results.length > 0 && (
                                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                                    {results
                                        .filter((c) => !members.some((m) => m.id === c.id))
                                        .map((c) => (
                                            <li key={c.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => add(c)}
                                                    disabled={busy === c.id}
                                                    className="flex w-full items-center gap-3 rounded px-1 py-2 text-left transition duration-100 ease-linear hover:bg-primary_hover disabled:opacity-50"
                                                >
                                                    <Avatar
                                                        size="sm"
                                                        src={c.photo_url ?? undefined}
                                                        alt={c.first_name}
                                                        initials={c.first_name.charAt(0).toUpperCase()}
                                                        className="shrink-0 bg-white p-px shadow-xs"
                                                    />
                                                    <span className="min-w-0 flex-1 truncate text-sm text-secondary">
                                                        {nameOf(c)}
                                                    </span>
                                                    <span className="shrink-0 text-sm text-brand-500">
                                                        {busy === c.id ? "Adding…" : "Add"}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>

                        {error && <p className="text-sm text-error-primary">{error}</p>}

                        <button type="button" onClick={() => setConfirming(true)} className={SECONDARY_BTN}>
                            Delete group
                        </button>
                    </>
                )}

                {!loading && !loadError && confirming && (
                    <>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                        <div className="flex flex-col gap-3">
                            <button type="button" onClick={destroy} disabled={busy === "delete"} className={PRIMARY_BTN}>
                                {busy === "delete" ? "Deleting…" : "Delete group"}
                            </button>
                            <button type="button" onClick={() => setConfirming(false)} className={SECONDARY_BTN}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
