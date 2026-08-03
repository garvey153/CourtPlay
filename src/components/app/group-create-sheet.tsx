import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { FIELD } from "@/components/base/input/field-styles";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { supabase } from "@/lib/supabase";
import { describeActionError } from "@/utils/load-error";

interface GroupCreateSheetProps {
    onClose: () => void;
    /** Called with the new group's id so the caller can open it straight away. */
    onCreated: (groupId: string) => void;
}

/** Name a new group. The creator becomes its owner; inviting happens in the detail sheet. */
export function GroupCreateSheet({ onClose, onCreated }: GroupCreateSheetProps) {
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setSaving(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc("create_group", { p_name: trimmed });
        setSaving(false);

        // The RPC reports refusals in its payload rather than throwing, so a
        // successful call with success:false still has to be surfaced.
        if (rpcError || !data?.success) {
            console.error("create_group failed:", rpcError ?? data);
            setError(data?.error ?? describeActionError(rpcError, "create that group"));
            return;
        }
        onCreated(data.group_id as string);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-create-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="group-create-title" className="text-md font-semibold text-primary">
                        New group
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

                <Input
                    label="Group name"
                    placeholder="e.g. Tuesday Nighters"
                    value={name}
                    onChange={setName}
                    size="sm"
                    isRequired
                    maxLength={60}
                    wrapperClassName={FIELD}
                />

                {error && <p className="text-sm text-error-primary">{error}</p>}

                <div className="mt-4 flex flex-col gap-3">
                    <button type="button" onClick={handleCreate} disabled={saving || !name.trim()} className={PRIMARY_BTN}>
                        {saving ? <Spinner size="sm" tone="on-brand" /> : "Create group"}
                    </button>
                    <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
