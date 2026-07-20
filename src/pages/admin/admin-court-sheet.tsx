import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { supabase } from "@/lib/supabase";
import type { AdminCourtRow, CustomCourtRow } from "./admin-court-card";

const PRIMARY_BTN =
    "flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear enabled:hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
    "flex items-center justify-center rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

const ButtonSpinner = () => (
    <span className="size-5 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" aria-hidden="true" />
);

/** Which flow the sheet is driving. */
export type CourtSheetTarget =
    | { mode: "create" }
    | { mode: "court"; court: AdminCourtRow }
    | { mode: "custom"; custom: CustomCourtRow };

interface AdminCourtSheetProps {
    target: CourtSheetTarget;
    onClose: () => void;
    /** Refetch the list after a successful mutation. */
    onSaved: () => void;
}

type Busy = null | "save" | "action";

/**
 * Bottom sheet for the admin Courts tab. Adds a court to the master list, edits/deactivates
 * an existing one, or handles a custom court entered on posts — "Add court" promotes it to the
 * master list, "Remove" drops it from the Custom list. Neither action touches the live posts.
 */
export function AdminCourtSheet({ target, onClose, onSaved }: AdminCourtSheetProps) {
    const initialName =
        target.mode === "court" ? target.court.name : target.mode === "custom" ? target.custom.court_name : "";
    const initialArea =
        target.mode === "court" ? target.court.area ?? "" : target.mode === "custom" ? target.custom.area ?? "" : "";

    const [name, setName] = useState(initialName);
    const [area, setArea] = useState(initialArea);
    const [busy, setBusy] = useState<Busy>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const finish = (err: { message: string } | null, verb: string) => {
        setBusy(null);
        if (err) setError(`Failed to ${verb}: ${err.message}`);
        else onSaved();
    };

    // Save: edit an existing master court, or add one — from scratch or by promoting a custom court.
    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setBusy("save");
        setError(null);
        const areaVal = area.trim() || null;

        if (target.mode === "court") {
            const { error: updateErr } = await supabase
                .from("courts")
                .update({ name: trimmed, area: areaVal })
                .eq("id", target.court.id);
            finish(updateErr, "save court");
            return;
        }

        // create + custom both add a court to the master list.
        const { error: insertErr } = await supabase.from("courts").insert({ name: trimmed, area: areaVal, active: true });
        if (insertErr) {
            finish(insertErr, "add court");
            return;
        }

        // Promoting a custom court also removes it from the Custom list; live posts keep their text.
        if (target.mode === "custom") {
            const { error: delErr } = await supabase.from("custom_court_submissions").delete().eq("id", target.custom.id);
            finish(delErr, "add court");
            return;
        }

        finish(null, "add court");
    };

    // Deactivate a master court, or remove a custom court from the Custom list.
    const handleAction = async () => {
        setBusy("action");
        setError(null);

        if (target.mode === "court") {
            const { error: updateErr } = await supabase.from("courts").update({ active: false }).eq("id", target.court.id);
            finish(updateErr, "deactivate court");
            return;
        }

        if (target.mode === "custom") {
            // Removing a custom court has no impact on the live posts using it.
            const { error: delErr } = await supabase.from("custom_court_submissions").delete().eq("id", target.custom.id);
            finish(delErr, "remove court");
        }
    };

    const heading = target.mode === "create" ? "Add court" : target.mode === "custom" ? "Custom court" : "Edit court";
    const saveLabel = target.mode === "court" ? "Save" : "Add court";
    const actionLabel = target.mode === "custom" ? "Remove" : "Deactivate";

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-court-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="admin-court-sheet-title" className="text-md font-semibold text-primary">
                        {heading}
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

                <div className="flex flex-col gap-3">
                    <Input label="Court name" placeholder="e.g. Longshore Tennis Club" value={name} onChange={setName} size="sm" isRequired />
                    <Input label="Area" placeholder="e.g. Westport" value={area} onChange={setArea} size="sm" />
                </div>

                {error && <p className="text-sm text-error-primary">{error}</p>}

                {/* 32px between the last field and the buttons (sheet gap-4 = 16px + mt-4 = 16px). */}
                <div className="mt-4 flex flex-col gap-3">
                    <button type="button" onClick={handleSave} disabled={busy !== null || !name.trim()} className={PRIMARY_BTN}>
                        {busy === "save" ? <ButtonSpinner /> : saveLabel}
                    </button>
                    {target.mode !== "create" && (
                        <button type="button" onClick={handleAction} disabled={busy !== null} className={SECONDARY_BTN}>
                            {busy === "action" ? "Working…" : actionLabel}
                        </button>
                    )}
                    <button type="button" onClick={onClose} disabled={busy !== null} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
