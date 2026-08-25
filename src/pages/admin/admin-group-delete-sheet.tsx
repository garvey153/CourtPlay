import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { LoadingState, Spinner } from "@/components/application/loading-indicator/spinner";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { sendNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { describeActionError } from "@/utils/load-error";
import type { AdminGroupRow } from "./admin-group-card";

interface AdminGroupDeleteSheetProps {
    group: AdminGroupRow;
    onClose: () => void;
    onDeleted: () => void;
}

/**
 * Confirmation for deleting a group from the admin tab, following the group
 * detail sheet's confirm: disclaimer, a summary card of what is about to go,
 * then "Yes, delete" over "No, keep it".
 *
 * It re-reads the roster rather than taking it from the edit screen. The admin
 * may have added or removed people in that form WITHOUT saving, so its state is
 * not who is actually in the group — and the people notified have to be the
 * real ones.
 */
export function AdminGroupDeleteSheet({ group, onClose, onDeleted }: AdminGroupDeleteSheetProps) {
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.rpc("admin_get_group", { p_group_id: group.id });
        const members = Array.isArray(data?.members) ? (data.members as Array<{ id: string; is_creator: boolean }>) : [];
        // The creator is left out: losing their own group is not news delivered
        // by notification, and the same rule holds when they close it themselves.
        setMemberIds(members.filter((m) => !m.is_creator).map((m) => m.id));
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

    const confirm = async () => {
        setBusy(true);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_delete_group", { p_group_id: group.id });
        setBusy(false);
        if (rpcError || !data?.success) {
            setError(data?.error ?? describeActionError(rpcError, "delete that group"));
            return;
        }
        memberIds.forEach((id) =>
            sendNotification({ notification_type: "group_removed", group_id: group.id, target_user_id: id }),
        );
        onDeleted();
    };

    const players = `${group.member_count} ${group.member_count === 1 ? "player" : "players"}`;

    return (
        <div
            // z-[60], above the edit screen's z-50: this sheet opens ON TOP of
            // it rather than replacing it, and relying on DOM order alone to win
            // an equal z-index would break the moment the two are reordered.
            className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-group-delete-title"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[8px]" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="admin-group-delete-title" className="min-w-0 text-md font-semibold text-primary">
                        Delete this group?
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

                <p className="text-sm text-secondary">
                    It disappears for everyone in it, and any private post shared with the group stops being
                    visible to them. This can't be undone.
                </p>

                <div className="flex flex-col gap-1 rounded-lg border border-neutral-600 p-4">
                    <p className="text-md font-semibold text-primary">{group.name}</p>
                    <p className="text-sm text-secondary">
                        {[group.creator_name, players, group.details].filter(Boolean).join(" · ")}
                    </p>
                </div>

                {loading && <LoadingState variant="block" label="Loading group" />}
                {error && <p className="text-sm text-error-primary">{error}</p>}

                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={confirm} disabled={busy || loading} className={PRIMARY_BTN}>
                        {busy ? <Spinner size="sm" tone="on-brand" /> : "Yes, delete"}
                    </button>
                    <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BTN}>
                        No, keep it
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
