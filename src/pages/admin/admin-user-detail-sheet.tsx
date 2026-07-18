import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { supabase } from "@/lib/supabase";
import { skillLabel } from "@/utils/skill-label";
import { userDisplayName, type AdminUserRow } from "./admin-user-card";

const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Mode = "view" | "confirmSuspend";

interface AdminUserDetailSheetProps {
    user: AdminUserRow;
    onClose: () => void;
    /** Refetch the list after a successful suspend/admin change. */
    onSaved: () => void;
}

/** Admin moderation sheet for a single user — suspend/unsuspend and grant/revoke admin. */
export function AdminUserDetailSheet({ user, onClose, onSaved }: AdminUserDetailSheetProps) {
    const [mode, setMode] = useState<Mode>("view");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const name = userDisplayName(user);
    const skill = skillLabel(user.skill_level);
    const statusLabel = user.is_suspended ? "Suspended" : "Active";

    const runUpdate = async (patch: Record<string, unknown>, failVerb: string) => {
        setLoading(true);
        setError(null);
        const { error: updateError } = await supabase.from("users").update(patch).eq("id", user.id);
        setLoading(false);
        if (updateError) {
            setError(`Failed to ${failVerb}: ${updateError.message}`);
        } else {
            onSaved();
        }
    };

    const closeBtn = (
        <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
        >
            <XClose className="size-5" strokeWidth={1} />
        </button>
    );

    const errorLine = error ? <p className="text-sm text-error-primary">{error}</p> : null;

    let body: React.ReactNode;
    if (mode === "confirmSuspend") {
        body = (
            <>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-md font-semibold text-primary">Suspend this user?</h2>
                        <p className="text-sm text-secondary">They won&apos;t be able to post or claim spots until reinstated.</p>
                    </div>
                    {closeBtn}
                </div>
                {errorLine}
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={() => runUpdate({ is_suspended: true }, "suspend")} disabled={loading} className={PRIMARY_BTN}>
                        {loading ? <ButtonSpinner /> : "Yes, suspend"}
                    </button>
                    <button type="button" onClick={() => setMode("view")} disabled={loading} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </>
        );
    } else {
        body = (
            <>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                            size="md"
                            src={user.photo_url}
                            alt={name}
                            initials={(user.first_name ?? user.email).charAt(0).toUpperCase()}
                            className="shrink-0 bg-white p-px shadow-xs"
                        />
                        <div className="flex min-w-0 flex-col">
                            <div className="flex items-center gap-2">
                                <h2 id="admin-user-sheet-title" className="truncate text-md font-semibold text-primary">
                                    {name}
                                </h2>
                                {user.is_admin && <span className="shrink-0 text-xs font-semibold text-brand-secondary">Admin</span>}
                            </div>
                            {skill && <p className="truncate text-xs text-secondary">{skill}</p>}
                        </div>
                    </div>
                    {closeBtn}
                </div>

                {/* Metadata */}
                <dl className="flex flex-col gap-2 rounded-lg border border-neutral-700 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                        <dt className="text-tertiary">Status</dt>
                        <dd className={user.is_suspended ? "font-semibold text-error-primary" : "text-success-primary"}>{statusLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-tertiary">Email</dt>
                        <dd className="truncate text-secondary">{user.email}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-tertiary">Skill</dt>
                        <dd className="text-secondary">{skill ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-tertiary">Joined</dt>
                        <dd className="text-secondary">{formatDate(user.created_at)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-tertiary">Reports</dt>
                        <dd className={user.report_count > 0 ? "font-semibold text-warning-primary" : "text-secondary"}>{user.report_count}</dd>
                    </div>
                </dl>

                {errorLine}

                <div className="mt-2 flex flex-col gap-3">
                    {user.is_suspended ? (
                        <button type="button" onClick={() => runUpdate({ is_suspended: false }, "unsuspend")} disabled={loading} className={PRIMARY_BTN}>
                            {loading ? <ButtonSpinner /> : "Unsuspend user"}
                        </button>
                    ) : (
                        <button type="button" onClick={() => setMode("confirmSuspend")} disabled={loading} className={SECONDARY_BTN}>
                            Suspend user
                        </button>
                    )}
                    <button type="button" onClick={() => runUpdate({ is_admin: !user.is_admin }, "update admin")} disabled={loading} className={SECONDARY_BTN}>
                        {loading ? <ButtonSpinner /> : user.is_admin ? "Remove admin" : "Make admin"}
                    </button>
                </div>
            </>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                {body}
            </motion.div>
        </div>
    );
}
