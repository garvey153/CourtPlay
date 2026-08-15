import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "@untitledui/icons";
import { SearchField } from "@/components/base/input/search-field";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { supabase } from "@/lib/supabase";
import { LoadingState } from "@/components/application/loading-indicator/spinner";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";
import { AdminInviteCard, type AdminInviteRow } from "./admin-invite-card";
import { AdminInviteDetailSheet } from "./admin-invite-detail-sheet";
import { AdminSeedInvitesSheet } from "./admin-seed-invites-sheet";

/** Who is allowed into the closed beta, and who has taken it up. */
export function AdminInvites() {
    const [invites, setInvites] = useState<AdminInviteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [search, setSearch] = useState("");
    const [detail, setDetail] = useState<AdminInviteRow | null>(null);
    const [seeding, setSeeding] = useState(false);

    const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_get_invites");
        if (rpcError) {
            setError(rpcError);
            setLoading(false);
            return;
        }
        setInvites(Array.isArray(data) ? (data as AdminInviteRow[]) : []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return invites;
        return invites.filter((i) =>
            [i.email, i.inviter_name, i.accepted_name].filter(Boolean).join(" ").toLowerCase().includes(q),
        );
    }, [invites, search]);

    const pending = invites.filter((i) => !i.accepted_at).length;

    return (
        <>
            <PullToRefresh
                onRefresh={() => fetchData({ silent: true })}
                className="flex flex-1 flex-col gap-4"
                contentClassName="flex flex-1 flex-col"
                header={
                    <>
                        <div className="flex items-center gap-3">
                            <SearchField
                                className="flex-1"
                                variant="outline"
                                value={search}
                                onChange={setSearch}
                                placeholder="Search invites"
                            />
                            <button
                                type="button"
                                onClick={() => setSeeding(true)}
                                aria-label="Add players to the beta"
                                className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-500 text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600"
                            >
                                <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
                            </button>
                        </div>
                        {!loading && !error && invites.length > 0 && (
                            <p className="text-sm text-tertiary">
                                {invites.length} on the list · {invites.length - pending} joined · {pending} waiting
                            </p>
                        )}
                    </>
                }
            >
                {loading ? (
                    <LoadingState variant="grow" label="Loading invites" />
                ) : error ? (
                    <ErrorState variant="grow" error={error} subject="invites" onRetry={() => fetchData()} />
                ) : visible.length === 0 ? (
                    <EmptyState
                        variant="grow"
                        title={search ? "No invites by that name" : "Nobody invited yet"}
                        description={
                            search
                                ? "Try a different search."
                                : "Add the players you want in the beta and they'll be able to sign up."
                        }
                        actionLabel={search ? "Clear search" : "Add players"}
                        onAction={search ? () => setSearch("") : () => setSeeding(true)}
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        {visible.map((invite) => (
                            <AdminInviteCard key={invite.id} invite={invite} onOpen={() => setDetail(invite)} />
                        ))}
                    </div>
                )}
            </PullToRefresh>

            {detail && (
                <AdminInviteDetailSheet
                    invite={detail}
                    onClose={() => setDetail(null)}
                    onChanged={() => {
                        setDetail(null);
                        fetchData({ silent: true });
                    }}
                />
            )}
            {seeding && (
                <AdminSeedInvitesSheet
                    onClose={() => setSeeding(false)}
                    onSeeded={() => fetchData({ silent: true })}
                />
            )}
        </>
    );
}
