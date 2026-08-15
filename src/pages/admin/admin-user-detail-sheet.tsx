import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { supabase } from "@/lib/supabase";
import { skillLabel } from "@/utils/skill-label";
import { userDisplayName, type AdminUserRow } from "./admin-user-card";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { describeActionError } from "@/utils/load-error";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";



function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Mode = "view" | "confirmSuspend" | "confirmDelete";

interface DeletePreview {
    email: string;
    blockers: Array<{ kind: string; message: string; groups?: Array<{ name: string; members: number }> }>;
    counts: Record<string, number>;
}

/** The counts worth naming, in the order they matter, with their copy. */
const COUNT_LABELS: Array<[key: string, one: string, many: string]> = [
    ["posts", "post", "posts"],
    ["claims_on_posts", "claim on their posts", "claims on their posts"],
    ["claims_made", "claim they made", "claims they made"],
    ["messages", "message", "messages"],
    ["follows", "follow", "follows"],
    ["group_memberships", "group membership", "group memberships"],
    ["solo_groups", "group only they were in", "groups only they were in"],
    ["reports_filed", "report they filed", "reports they filed"],
];

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
    const [preview, setPreview] = useState<DeletePreview | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const name = userDisplayName(user);
    const skill = skillLabel(user.skill_level);
    const statusLabel = user.is_suspended ? "Deactivated" : "Active";

    const runUpdate = async (patch: Record<string, unknown>, failVerb: string) => {
        setLoading(true);
        setError(null);
        const { error: updateError } = await supabase.from("users").update(patch).eq("id", user.id);
        setLoading(false);
        if (updateError) {
            (console.error("admin user action failed:", updateError), setError(describeActionError(updateError, failVerb)));
        } else {
            onSaved();
        }
    };

    /**
     * Ask the server what a delete would take with it, then show that before
     * anything is committed. The same guards run again inside admin_delete_user —
     * this is the courtesy, not the control.
     */
    const openDelete = async () => {
        setLoading(true);
        setError(null);
        setPreview(null);
        const { data, error: rpcError } = await supabase.rpc("admin_user_delete_preview", { p_user_id: user.id });
        setLoading(false);
        if (rpcError || (data && typeof data === "object" && "error" in data)) {
            setError((data as { error?: string })?.error ?? describeActionError(rpcError, "check that user"));
            return;
        }
        setPreview(data as DeletePreview);
        setMode("confirmDelete");
    };

    const runDelete = async () => {
        setLoading(true);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_delete_user", { p_user_id: user.id });
        setLoading(false);
        if (rpcError || !(data as { success?: boolean })?.success) {
            setError((data as { error?: string })?.error ?? describeActionError(rpcError, "delete that user"));
            return;
        }
        onSaved();
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
                        <h2 className="text-md font-semibold text-primary">Deactivate this user?</h2>
                        <p className="text-sm text-secondary">They won&apos;t be able to post or claim spots until reactivated.</p>
                    </div>
                    {closeBtn}
                </div>
                {errorLine}
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={() => runUpdate({ is_suspended: true }, "deactivate that user")} disabled={loading} className={PRIMARY_BTN}>
                        {loading ? <Spinner size="sm" tone="on-brand" /> : "Yes, deactivate"}
                    </button>
                    <button type="button" onClick={() => setMode("view")} disabled={loading} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </>
        );
    } else if (mode === "confirmDelete") {
        const blocked = (preview?.blockers.length ?? 0) > 0;
        const lines = COUNT_LABELS.map(([key, one, many]) => {
            const n = preview?.counts?.[key] ?? 0;
            return n > 0 ? `${n} ${n === 1 ? one : many}` : null;
        }).filter(Boolean) as string[];

        body = (
            <>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-md font-semibold text-primary">Delete {name} from the system?</h2>
                        <p className="text-sm text-secondary">
                            This removes their account and login for good. It cannot be undone.
                        </p>
                    </div>
                    {closeBtn}
                </div>

                {lines.length > 0 && (
                    <div className="rounded-lg border border-neutral-700 p-4">
                        <p className="text-sm font-semibold text-primary">This will also delete</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                            {lines.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* A delete may destroy their data and not anyone else's. Where it
                    would, the server refuses and names what to fix. */}
                {blocked && (
                    <div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
                        {preview?.blockers.map((b) => (
                            <div key={b.kind} className="not-first:mt-3">
                                <p className="text-sm font-semibold text-error-primary">{b.message}</p>
                                {b.groups && (
                                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-secondary">
                                        {b.groups.map((g) => (
                                            <li key={g.name}>
                                                {g.name} · {g.members} {g.members === 1 ? "other member" : "other members"}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {errorLine}

                <div className="mt-2 flex flex-col gap-3">
                    {!blocked && (
                        <button
                            type="button"
                            onClick={runDelete}
                            disabled={loading}
                            className="flex h-11 w-full items-center justify-center rounded-lg bg-red-600 text-sm font-semibold text-white transition duration-100 ease-linear hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? <Spinner size="sm" tone="current" /> : "Yes, delete permanently"}
                        </button>
                    )}
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
                        <>
                            <button type="button" onClick={() => runUpdate({ is_suspended: false }, "reactivate that user")} disabled={loading} className={PRIMARY_BTN}>
                                {loading ? <Spinner size="sm" tone="on-brand" /> : "Reactivate user"}
                            </button>
                            {/* Only once deactivated. Deactivation is the reversible
                                step, and requiring it first means nobody is deleted
                                straight from a working account by a misclick. */}
                            <button
                                type="button"
                                onClick={openDelete}
                                disabled={loading}
                                className="flex h-11 w-full items-center justify-center rounded-lg border border-red-900 text-sm font-semibold text-error-primary transition duration-100 ease-linear hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? <Spinner size="sm" tone="current" /> : "Delete from the system"}
                            </button>
                        </>
                    ) : (
                        <button type="button" onClick={() => setMode("confirmSuspend")} disabled={loading} className={PRIMARY_BTN}>
                            Deactivate user
                        </button>
                    )}
                    <button type="button" onClick={() => runUpdate({ is_admin: !user.is_admin }, "change that user's admin access")} disabled={loading} className={SECONDARY_BTN}>
                        {loading ? <Spinner size="sm" tone="on-brand" /> : user.is_admin ? "Remove admin" : "Make admin"}
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
