import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { LoadingState, Spinner } from "@/components/application/loading-indicator/spinner";
import { ErrorState } from "@/components/application/loading-indicator/area-state";
import { supabase } from "@/lib/supabase";
import { sendNotification } from "@/lib/notifications";
import { describeActionError } from "@/utils/load-error";
import { skillLabel } from "@/utils/skill-label";
import type { GroupDetail } from "@/types/groups";

interface GroupDetailSheetProps {
    groupId: string;
    onClose: () => void;
    /** Refetch the caller's groups after anything that changes membership. */
    onChanged: () => void;
    /** Opens the edit sheet. Only offered to the creator. */
    onEdit: (group: GroupDetail) => void;
}

/**
 * A group's roster, and the only place its lifecycle is driven.
 *
 * Three exits, all confirmed, and which one you get depends on who you are and
 * whether the group is still open:
 *
 *   creator, open    Close group   — their only way out. Ends it for everyone.
 *   member, open     Leave group   — available at any time.
 *   anyone, closed   Remove group  — clears the tombstone from your profile.
 *
 * The creator cannot leave an open group: closing is their exit, and leaving
 * would strand the rest with a group nobody can administer. Editing is
 * creator-only and disappears once closed — a finished group is not editable.
 */
export function GroupDetailSheet({ groupId, onClose, onChanged, onEdit }: GroupDetailSheetProps) {
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        // null means the caller is no longer a member — read as gone, not empty.
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

    const run = async (rpc: "leave_group" | "close_group", verb: string) => {
        setBusy(true);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc(rpc, { p_group_id: groupId });
        setBusy(false);
        if (rpcError || !data?.success) {
            console.error(`${rpc} failed:`, rpcError ?? data);
            setError(data?.error ?? describeActionError(rpcError, verb));
            return;
        }

        // Closing ends the group for everyone still in it. Only the creator can
        // reach this, and only they are authorised to trigger it, so the fan-out
        // is bounded to their own group's members.
        if (rpc === "close_group" && group) {
            for (const m of group.members) {
                if (m.id === group.created_by) continue;
                sendNotification({ notification_type: "group_removed", group_id: group.id, target_user_id: m.id });
            }
        }

        onChanged();
        onClose();
    };

    const memberCount = group?.members.length ?? 0;
    const closed = !!group?.is_closed;
    // Which exit this viewer gets. Closed wins over role: once a group is over,
    // everyone left is just clearing a tombstone.
    const exit = closed
        ? { label: "Remove group", title: "Remove group?", rpc: "leave_group" as const, verb: "remove that group" }
        : group?.is_creator
          ? { label: "Close group", title: "Close group?", rpc: "close_group" as const, verb: "close that group" }
          : { label: "Leave group", title: "Leave group?", rpc: "leave_group" as const, verb: "leave that group" };

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
                    <div className="min-w-0">
                        <h2 id="group-detail-title" className="truncate text-md font-semibold text-primary">
                            {confirming ? exit.title : (group?.name ?? "Group")}
                        </h2>
                        {!confirming && group && (
                            <>
                                <p className="truncate text-sm text-tertiary">
                                    {[group.details, `${memberCount} player${memberCount === 1 ? "" : "s"}`]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                                {closed && (
                                    <span className="mt-1 inline-block rounded-lg bg-red-900 px-2 py-0.5 text-xs font-semibold text-red-400">
                                        Closed
                                    </span>
                                )}
                            </>
                        )}
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
                {/* !! because loadError is `unknown` — a bare && widens the JSX expression to unknown. */}
                {!loading && !!loadError && (
                    <ErrorState variant="block" error={loadError} subject="that group" onRetry={load} />
                )}
                {!loading && !loadError && !group && (
                    <p className="py-8 text-center text-sm text-tertiary">This group is no longer available.</p>
                )}

                {!loading && group && !confirming && (
                    <>
                        <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                            {group.members.map((m) => (
                                <li key={m.id} className="flex items-center gap-3 px-1 py-2">
                                    <Avatar
                                        size="sm"
                                        src={m.photo_url ?? undefined}
                                        alt={m.first_name}
                                        initials={m.first_name.charAt(0).toUpperCase()}
                                        className="shrink-0 bg-white p-px shadow-xs"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm text-secondary">
                                        {m.first_name}
                                        {m.last_name ? ` ${m.last_name.charAt(0)}.` : ""}
                                        {m.skill_level && ` · ${skillLabel(m.skill_level)}`}
                                    </span>
                                    {m.is_creator && <span className="shrink-0 text-xs text-tertiary">Creator</span>}
                                </li>
                            ))}
                        </ul>

                        {error && <p className="text-sm text-error-primary">{error}</p>}

                        <div className="flex flex-col gap-3">
                            {group.is_creator && !closed && (
                                <button type="button" onClick={() => onEdit(group)} className={PRIMARY_BTN}>
                                    Edit group
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setConfirming(true)}
                                className={group.is_creator && !closed ? SECONDARY_BTN : PRIMARY_BTN}
                            >
                                {exit.label}
                            </button>
                        </div>
                    </>
                )}

                {!loading && group && confirming && (
                    <>
                        <p className="text-sm text-tertiary">
                            {closed
                                ? `${group.name} is over. Removing it clears it from your profile${memberCount === 1 ? " and deletes it for good, since you're the last one in it" : ""}.`
                                : group.is_creator
                                  ? `Closing ${group.name} ends it for everyone. It stays on their profiles, marked closed, until each of them removes it.`
                                  : `You'll drop out of ${group.name}.`}
                        </p>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => run(exit.rpc, exit.verb)}
                                disabled={busy}
                                className={PRIMARY_BTN}
                            >
                                {busy ? <Spinner size="sm" tone="on-brand" /> : exit.label}
                            </button>
                            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={SECONDARY_BTN}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
