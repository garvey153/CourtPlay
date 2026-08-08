import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchSm, XClose } from "@untitledui/icons";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { supabase } from "@/lib/supabase";
import { LoadingState } from "@/components/application/loading-indicator/spinner";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";
import { AdminGroupCard, type AdminGroupRow } from "./admin-group-card";
import { GroupFormSheet } from "@/components/app/group-form-sheet";
import { AdminGroupDeleteSheet } from "./admin-group-delete-sheet";

/**
 * Admin Groups tab — every group in the app, with its roster behind a tap.
 *
 * Reads go through admin_get_groups() rather than a direct table select: the
 * RLS policy that lets admins read groups exists, but the list also needs the
 * creator's name and a live member count, and doing that client-side would mean
 * three round trips and a join the client has no business doing.
 */
export function AdminGroups() {
    const [groups, setGroups] = useState<AdminGroupRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [search, setSearch] = useState("");
    const [sheet, setSheet] = useState<AdminGroupRow | null>(null);
    /** Set when Delete is pressed on the edit screen — that screen closes first. */
    const [pendingDelete, setPendingDelete] = useState<AdminGroupRow | null>(null);

    const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc("admin_get_groups");
        if (rpcError) {
            setError(rpcError);
            setLoading(false);
            return;
        }
        setGroups(Array.isArray(data) ? (data as AdminGroupRow[]) : []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter((g) =>
            [g.name, g.creator_name, g.details].filter(Boolean).join(" ").toLowerCase().includes(q),
        );
    }, [groups, search]);

    // The sheet's own row can go stale under it (a removal changes the count),
    // so re-read it from the refreshed list rather than holding the old object.
    const openGroup = sheet ? (groups.find((g) => g.id === sheet.id) ?? sheet) : null;

    return (
        <>
            <PullToRefresh
                onRefresh={() => fetchData({ silent: true })}
                className="flex flex-1 flex-col gap-4"
                contentClassName="flex flex-1 flex-col"
                header={
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-neutral-700 px-3 shadow-xs">
                            <SearchSm className="size-6 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search groups"
                                className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                            />
                            {search && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => setSearch("")}
                                    className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-primary"
                                >
                                    <XClose className="size-5" strokeWidth={1} />
                                </button>
                            )}
                        </div>
                    </div>
                }
            >
                {loading ? (
                    <LoadingState variant="grow" />
                ) : error ? (
                    <ErrorState variant="grow" error={error} subject="groups" onRetry={() => fetchData()} />
                ) : visible.length === 0 ? (
                    search ? (
                        <EmptyState
                            variant="grow"
                            title="No groups match"
                            description="Nothing came back for that search. Try a different name."
                            actionLabel="Clear search"
                            onAction={() => setSearch("")}
                        />
                    ) : (
                        <EmptyState
                            variant="grow"
                            title="No groups yet"
                            description="Players create these from their profile. They'll show up here as they do."
                        />
                    )
                ) : (
                    <div className="flex flex-col gap-3">
                        {visible.map((g) => (
                            <AdminGroupCard key={g.id} group={g} onOpen={() => setSheet(g)} />
                        ))}
                    </div>
                )}
            </PullToRefresh>

            {/* The same Edit group screen a creator gets, in admin mode — one
                component, so "identical" stays true rather than being a claim
                two files have to keep agreeing on. */}
            {openGroup && (
                <GroupFormSheet
                    admin
                    groupId={openGroup.id}
                    onClose={() => setSheet(null)}
                    onSaved={() => {
                        setSheet(null);
                        fetchData({ silent: true });
                    }}
                    // The confirmation STACKS on top rather than replacing this
                    // screen: backing out of a delete should put you back where
                    // you were, mid-edit, not at the list having lost the form.
                    onRequestDelete={() => setPendingDelete(openGroup)}
                />
            )}

            {pendingDelete && (
                <AdminGroupDeleteSheet
                    group={pendingDelete}
                    // Closes only the confirmation, revealing the edit screen.
                    onClose={() => setPendingDelete(null)}
                    onDeleted={() => {
                        // The group is gone, so the form behind it has nothing
                        // left to edit — both close.
                        setPendingDelete(null);
                        setSheet(null);
                        fetchData({ silent: true });
                    }}
                />
            )}
        </>
    );
}
