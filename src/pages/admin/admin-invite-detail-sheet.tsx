import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { describeActionError } from "@/utils/load-error";
import { sendInvite } from "@/lib/invite";
import type { AdminInviteRow } from "./admin-invite-card";

/** One invite: resend the email, or take the address off the list. */
export function AdminInviteDetailSheet({
    invite,
    onClose,
    onChanged,
}: {
    invite: AdminInviteRow;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState<null | "send" | "revoke">(null);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const joined = !!invite.accepted_at;

    const resend = async () => {
        setBusy("send");
        setError(null);
        const result = await sendInvite(invite.email);
        setBusy(null);
        if (result.ok) setSent(true);
        else setError(result.message);
    };

    const revoke = async () => {
        setBusy("revoke");
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_revoke_invite", { p_invite_id: invite.id });
        setBusy(null);
        if (rpcError || !data?.success) {
            setError(data?.error ?? describeActionError(rpcError, "revoke that invite"));
            return;
        }
        onChanged();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-detail-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="invite-detail-title" className="min-w-0 truncate text-md font-semibold text-primary">
                        {invite.email}
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
                    {joined
                        ? `Joined${invite.accepted_name ? ` as ${invite.accepted_name}` : ""}.`
                        : "On the list, not signed up yet."}
                    {invite.inviter_name && ` Invited by ${invite.inviter_name}.`}
                    {invite.source === "backfill" && " Founding member."}
                </p>

                {sent && <p className="text-sm text-success-primary">Invite email sent again.</p>}
                {error && <p className="text-sm text-error-primary">{error}</p>}

                <div className="mt-2 flex flex-col gap-3">
                    {!joined && (
                        <>
                            {/* "Resend": adding someone now emails them, so anyone
                                on this list has already been sent one. */}
                            <button type="button" onClick={resend} disabled={busy !== null} className={PRIMARY_BTN}>
                                {busy === "send" ? <Spinner size="sm" tone="on-brand" /> : "Resend invite email"}
                            </button>
                            <button type="button" onClick={revoke} disabled={busy !== null} className={SECONDARY_BTN}>
                                {busy === "revoke" ? "Removing…" : "Remove from the list"}
                            </button>
                        </>
                    )}
                    <button type="button" onClick={onClose} disabled={busy !== null} className={SECONDARY_BTN}>
                        {joined ? "Done" : "Cancel"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
