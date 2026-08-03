import { useCallback, useEffect, useState } from "react";
import { Plus } from "@untitledui/icons";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar } from "@/components/base/avatar/avatar";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { GroupCreateSheet } from "@/components/app/group-create-sheet";
import { GroupDetailSheet } from "@/components/app/group-detail-sheet";
import { EmptyState, ErrorState } from "@/components/application/loading-indicator/area-state";
import { LoadingState } from "@/components/application/loading-indicator/spinner";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { supabase } from "@/lib/supabase";
import { describeActionError } from "@/utils/load-error";
import type { GroupSummary } from "@/types/groups";

/**
 * Groups — your crews, and any invites waiting on you.
 *
 * Invites are a separate section above the list rather than a badge on it:
 * responding is the whole point of the screen when one is pending, and burying
 * it in the roster would make it easy to miss.
 */
export function Groups() {
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [creating, setCreating] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [respondingTo, setRespondingTo] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoaded(false);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("get_my_groups");
        if (rpcError) {
            console.error("get_my_groups failed:", rpcError);
            setError(rpcError);
        } else {
            // Shape-check rather than cast. get_my_groups returns a jsonb array,
            // but the render filters this immediately, so anything else — null, or
            // a refusal object from a future revision — would crash the page
            // instead of degrading. Cheap insurance for a screen-level crash.
            setGroups(Array.isArray(data) ? (data as GroupSummary[]) : []);
        }
        setLoaded(true);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const respond = async (groupId: string, accept: boolean) => {
        setRespondingTo(groupId);
        setActionError(null);
        const { data, error: rpcError } = await supabase.rpc("respond_to_group_invite", {
            p_group_id: groupId,
            p_accept: accept,
        });
        setRespondingTo(null);
        if (rpcError || !data?.success) {
            console.error("respond_to_group_invite failed:", rpcError ?? data);
            setActionError(data?.error ?? describeActionError(rpcError, "answer that invite"));
            return;
        }
        load({ silent: true });
    };

    const invites = groups.filter((g) => g.my_status === "invited");
    const mine = groups.filter((g) => g.my_status === "active");

    return (
        <AppLayout>
            <PullToRefresh
                onRefresh={() => load({ silent: true })}
                className="flex min-h-full flex-col"
                contentClassName="flex min-h-full flex-1 flex-col"
            >
                {!loaded ? (
                    <LoadingState variant="fill" label="Loading your groups" />
                ) : error ? (
                    <ErrorState variant="fill" error={error} subject="your groups" onRetry={() => load()} />
                ) : groups.length === 0 ? (
                    <EmptyState
                        variant="fill"
                        title="No groups yet"
                        description="Start one, add your regulars, and you'll be able to share spots with just them."
                        actionLabel="Create a group"
                        onAction={() => setCreating(true)}
                    />
                ) : (
                    <div className="flex flex-col gap-6 px-5 py-4">
                        {actionError && <p className="text-sm text-error-primary">{actionError}</p>}

                        {invites.length > 0 && (
                            <section className="flex flex-col gap-3">
                                <h2 className="text-sm font-semibold text-tertiary">
                                    Invites ({invites.length})
                                </h2>
                                {invites.map((g) => (
                                    <div key={g.id} className="flex flex-col gap-3 rounded-lg bg-brand-800 p-4">
                                        <div>
                                            <p className="text-sm font-semibold text-primary">{g.name}</p>
                                            <p className="text-sm text-tertiary">
                                                {g.member_count} player{g.member_count === 1 ? "" : "s"}
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => respond(g.id, true)}
                                                disabled={respondingTo === g.id}
                                                className={PRIMARY_BTN}
                                            >
                                                Join
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => respond(g.id, false)}
                                                disabled={respondingTo === g.id}
                                                className={SECONDARY_BTN}
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        <section className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-tertiary">
                                    Your groups {mine.length > 0 && `(${mine.length})`}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="flex items-center gap-1 text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-primary"
                                >
                                    <Plus className="size-4" aria-hidden="true" />
                                    New
                                </button>
                            </div>

                            {mine.length === 0 ? (
                                <p className="text-sm text-tertiary">
                                    Nothing yet — create one to get your regulars in a row.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {mine.map((g) => (
                                        <li key={g.id}>
                                            <button
                                                type="button"
                                                onClick={() => setOpenId(g.id)}
                                                className="flex w-full items-center gap-3 rounded-lg border border-neutral-600 px-3 py-3 text-left transition duration-100 ease-linear hover:bg-secondary_hover"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-primary">{g.name}</p>
                                                    <p className="text-xs text-tertiary">
                                                        {g.member_count} player{g.member_count === 1 ? "" : "s"}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 -space-x-2">
                                                    {g.preview.slice(0, 4).map((m) => (
                                                        <Avatar
                                                            key={m.id}
                                                            size="xs"
                                                            src={m.photo_url ?? undefined}
                                                            alt={m.first_name}
                                                            initials={m.first_name.charAt(0).toUpperCase()}
                                                            className="bg-white p-px shadow-xs ring-2 ring-bg-primary"
                                                        />
                                                    ))}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )}
            </PullToRefresh>

            {creating && (
                <GroupCreateSheet
                    onClose={() => setCreating(false)}
                    onCreated={(id) => {
                        setCreating(false);
                        load({ silent: true });
                        // Straight into the new group so the obvious next step —
                        // adding people — is one tap away rather than a hunt.
                        setOpenId(id);
                    }}
                />
            )}

            {openId && (
                <GroupDetailSheet
                    groupId={openId}
                    onClose={() => setOpenId(null)}
                    onChanged={() => load({ silent: true })}
                />
            )}
        </AppLayout>
    );
}
