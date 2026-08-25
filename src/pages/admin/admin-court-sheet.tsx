import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { supabase } from "@/lib/supabase";
import type { AdminCourtRow, CustomCourtRow } from "./admin-court-card";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { describeActionError } from "@/utils/load-error";
import { FIELD } from "@/components/base/input/field-styles";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";



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
        if (err) (console.error("admin court action failed:", err), setError(describeActionError(err, verb)));
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
            finish(updateErr, "save that court");
            return;
        }

        // create + custom both add a court to the master list.
        const { error: insertErr } = await supabase.from("courts").insert({ name: trimmed, area: areaVal, active: true });
        if (insertErr) {
            finish(insertErr, "add that court");
            return;
        }

        // Promoting a custom court also removes it from the Custom list; live posts keep their text.
        if (target.mode === "custom") {
            const { error: delErr } = await supabase.from("custom_court_submissions").delete().eq("id", target.custom.id);
            finish(delErr, "add that court");
            return;
        }

        finish(null, "add that court");
    };

    // Deactivate a master court, or remove a custom court from the Custom list.
    const handleAction = async () => {
        setBusy("action");
        setError(null);

        if (target.mode === "court") {
            const { error: updateErr } = await supabase.from("courts").update({ active: false }).eq("id", target.court.id);
            finish(updateErr, "deactivate that court");
            return;
        }

        if (target.mode === "custom") {
            // Removing a custom court has no impact on the live posts using it.
            const { error: delErr } = await supabase.from("custom_court_submissions").delete().eq("id", target.custom.id);
            finish(delErr, "remove that court");
        }
    };

    const heading = target.mode === "create" ? "Add court" : target.mode === "custom" ? "Custom court" : "Edit court";
    const editing = target.mode === "court";
    const saveLabel = editing ? "Save changes" : "Add court";
    const actionLabel = target.mode === "custom" ? "Remove" : "Deactivate";

    // Only editing has something to be dirty against. Create starts empty, and
    // custom arrives prefilled precisely so it can be added as-is — gating either
    // on an edit would demand a pointless keystroke.
    //
    // Compared TRIMMED, unlike group-form-sheet, because handleSave trims before
    // writing: a trailing space is a change to the field but a no-op to the row.
    const dirty = !editing || name.trim() !== initialName.trim() || area.trim() !== initialArea.trim();

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-court-sheet-title"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[8px]" onClick={onClose} aria-hidden="true" />

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
                    <Input
                        label="Court name"
                        placeholder="e.g. Longshore Tennis Club"
                        value={name}
                        onChange={setName}
                        size="sm"
                        isRequired
                        wrapperClassName={FIELD}
                    />
                    <Input
                        label="Area"
                        placeholder="e.g. Westport"
                        value={area}
                        onChange={setArea}
                        size="sm"
                        wrapperClassName={FIELD}
                    />
                </div>

                {error && <p className="text-sm text-error-primary">{error}</p>}

                {/* 32px between the last field and the buttons (sheet gap-4 = 16px + mt-4 = 16px). */}
                <div className="mt-4 flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={busy !== null || !name.trim() || !dirty}
                        className={PRIMARY_BTN}
                    >
                        {busy === "save" ? <Spinner size="sm" tone="on-brand" /> : saveLabel}
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
