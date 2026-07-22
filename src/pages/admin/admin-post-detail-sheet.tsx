import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { supabase } from "@/lib/supabase";
import { formatWhen, formatPlayType, formatDuration, timeAgo } from "@/components/app/sub-card";
import { adminCardKind, type AdminPostRow } from "./admin-post-card";

const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

type Mode = "view" | "edit" | "confirmExpire" | "confirmDelete";

interface AdminPostDetailSheetProps {
    post: AdminPostRow;
    /** Admin user id, recorded as deleted_by on deletion. */
    currentUserId: string;
    onClose: () => void;
    /** Refetch the list after a successful edit/expire/delete. */
    onSaved: () => void;
}

/**
 * Admin moderation sheet for a single post. Holds the actions the old table row
 * exposed inline — Edit cost/location, Expire, Delete — behind a tap on the card.
 */
export function AdminPostDetailSheet({ post, currentUserId, onClose, onSaved }: AdminPostDetailSheetProps) {
    const [mode, setMode] = useState<Mode>("view");
    const [editCost, setEditCost] = useState(post.cost?.toString() ?? "");
    const [editLocation, setEditLocation] = useState(post.location ?? "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const { label } = adminCardKind(post);
    const title = [formatPlayType(post.play_type), "Tennis"].filter(Boolean).join(" ");
    const when = formatWhen(post.game_date, post.game_time);
    const court = post.location ?? post.custom_court;
    const subtitle = [court, post.skill_level ? `NTRP ${post.skill_level}` : null, formatDuration(post.duration)]
        .filter(Boolean)
        .join(" · ");
    // A missing price and $0 both read as "Free".
    const priceLabel = post.cost ? `$${post.cost % 1 === 0 ? post.cost : post.cost.toFixed(2)}` : "Free";

    const isActive = post.status === "active";
    const isDeleted = post.status === "deleted";

    // Cost is required (enter 0 for a free game); Save stays disabled until it's valid.
    const parsedCost = parseFloat(editCost);
    const costValid = editCost.trim() !== "" && !Number.isNaN(parsedCost) && parsedCost >= 0;

    const saveEdit = async () => {
        if (!costValid) return;
        setLoading(true);
        setError(null);
        const { error: updateError } = await supabase
            .from("posts")
            .update({
                cost: parsedCost,
                location: editLocation || null,
            })
            .eq("id", post.id);
        setLoading(false);
        if (updateError) {
            setError(`Failed to save: ${updateError.message}`);
        } else {
            onSaved();
        }
    };

    const expirePost = async () => {
        setLoading(true);
        setError(null);
        const { error: updateError } = await supabase.from("posts").update({ status: "expired" }).eq("id", post.id);
        setLoading(false);
        if (updateError) {
            setError(`Failed to expire: ${updateError.message}`);
        } else {
            onSaved();
        }
    };

    const deletePost = async () => {
        setLoading(true);
        setError(null);
        const { error: updateError } = await supabase
            .from("posts")
            .update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: currentUserId })
            .eq("id", post.id);
        setLoading(false);
        if (updateError) {
            setError(`Failed to delete: ${updateError.message}`);
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

    const header = (
        <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h2 id="admin-post-sheet-title" className="text-md font-semibold text-primary">
                        {title}
                        {when && ` · ${when}`}
                    </h2>
                    <span className="shrink-0 text-xs font-semibold text-tertiary">{label}</span>
                </div>
                {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
            </div>
            {closeBtn}
        </div>
    );

    const posterRow = (
        <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
                <Avatar
                    size="xs"
                    src={post.author_photo_url}
                    alt={post.author_first_name}
                    initials={post.author_first_name.charAt(0).toUpperCase()}
                    className="shrink-0 bg-white p-px shadow-xs"
                />
                <span className="truncate text-xs text-tertiary">
                    {post.author_first_name} · {timeAgo(post.created_at)}
                </span>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">{priceLabel}</span>
        </div>
    );

    const errorLine = error ? <p className="text-sm text-error-primary">{error}</p> : null;

    let body: React.ReactNode;
    if (mode === "edit") {
        body = (
            <>
                {header}
                {posterRow}
                <div className="mt-2 flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-secondary">Location</span>
                        <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            placeholder="Location"
                            className="h-10 rounded-lg border border-neutral-600 bg-tertiary px-3 text-sm text-primary shadow-xs placeholder:text-placeholder focus:outline-none"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-secondary">
                            Cost <span className="text-error-primary">*</span>
                        </span>
                        <input
                            type="number"
                            min="0"
                            value={editCost}
                            onChange={(e) => setEditCost(e.target.value)}
                            placeholder="Cost"
                            className="h-10 rounded-lg border border-neutral-600 bg-tertiary px-3 text-sm text-primary shadow-xs placeholder:text-placeholder focus:outline-none"
                        />
                        {!costValid && <p className="text-xs text-error-primary">Price is required — enter 0 for a free game.</p>}
                    </label>
                </div>
                {errorLine}
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={saveEdit} disabled={loading || !costValid} className={PRIMARY_BTN}>
                        {loading ? <ButtonSpinner /> : "Save changes"}
                    </button>
                    <button type="button" onClick={() => setMode("view")} disabled={loading} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </>
        );
    } else if (mode === "confirmExpire") {
        body = (
            <>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-md font-semibold text-primary">Expire this post?</h2>
                        <p className="text-sm text-secondary">It will stop showing as open in the feed.</p>
                    </div>
                    {closeBtn}
                </div>
                {errorLine}
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={expirePost} disabled={loading} className={PRIMARY_BTN}>
                        {loading ? <ButtonSpinner /> : "Yes, expire"}
                    </button>
                    <button type="button" onClick={() => setMode("view")} disabled={loading} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </>
        );
    } else if (mode === "confirmDelete") {
        body = (
            <>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-md font-semibold text-primary">Delete this post?</h2>
                        <p className="text-sm text-secondary">This removes it from the app for everyone.</p>
                    </div>
                    {closeBtn}
                </div>
                {errorLine}
                <div className="mt-2 flex flex-col gap-3">
                    <button type="button" onClick={deletePost} disabled={loading} className={PRIMARY_BTN}>
                        {loading ? <ButtonSpinner /> : "Yes, delete"}
                    </button>
                    <button type="button" onClick={() => setMode("view")} disabled={loading} className={SECONDARY_BTN}>
                        No, keep it
                    </button>
                </div>
            </>
        );
    } else {
        body = (
            <>
                {header}
                {posterRow}
                {post.notes && (
                    <div className="w-full rounded-lg rounded-tl-none border border-neutral-600 px-3 py-2.5">
                        <p className="text-sm text-secondary">“{post.notes}”</p>
                    </div>
                )}
                {errorLine}
                <div className="mt-4 flex flex-col gap-3">
                    <button type="button" onClick={() => setMode("edit")} className={PRIMARY_BTN}>
                        Edit details
                    </button>
                    {isActive && (
                        <button type="button" onClick={() => setMode("confirmExpire")} className={SECONDARY_BTN}>
                            Expire post
                        </button>
                    )}
                    {!isDeleted && (
                        <button type="button" onClick={() => setMode("confirmDelete")} className={SECONDARY_BTN}>
                            Delete post
                        </button>
                    )}
                </div>
            </>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-post-sheet-title"
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
