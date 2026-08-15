import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { describeActionError } from "@/utils/load-error";

interface SeedResult {
    submitted: number;
    inserted: number;
    already_there: number;
    rejected: string[];
    total_invited: number;
}

/**
 * Paste a list of emails onto the invite list.
 *
 * Seeding is separate from sending: these rows let people in, and telling them
 * is a second decision. A list pasted from a spreadsheet is the shape this has
 * to accept, so it splits on commas, semicolons, whitespace and newlines alike.
 */
export function AdminSeedInvitesSheet({ onClose, onSeeded }: { onClose: () => void; onSeeded: () => void }) {
    const [raw, setRaw] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SeedResult | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const emails = raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const submit = async () => {
        setBusy(true);
        setError(null);
        const { data, error: rpcError } = await supabase.rpc("admin_seed_invites", { p_emails: emails });
        setBusy(false);
        if (rpcError) {
            setError(describeActionError(rpcError, "add those invites"));
            return;
        }
        setResult(data as SeedResult);
        onSeeded();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seed-invites-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="seed-invites-title" className="min-w-0 text-md font-semibold text-primary">
                        {result ? "Added to the list" : "Add players to the beta"}
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

                {result ? (
                    <>
                        <p className="text-sm text-secondary">
                            <span className="font-semibold text-primary">{result.inserted}</span> added
                            {result.already_there > 0 && `, ${result.already_there} already on the list`}. The list now
                            holds {result.total_invited}.
                        </p>
                        {result.rejected.length > 0 && (
                            <div className="rounded-lg bg-tertiary p-3">
                                <p className="text-sm font-semibold text-primary">
                                    {result.rejected.length} didn't look like an email
                                </p>
                                <p className="mt-1 break-words text-sm text-secondary">{result.rejected.join(", ")}</p>
                            </div>
                        )}
                        <p className="text-sm text-tertiary">
                            They can sign up now. Sending them an invite email is a separate step.
                        </p>
                        <button type="button" onClick={onClose} className={PRIMARY_BTN}>
                            Done
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-secondary">
                            Paste addresses separated by commas, spaces or new lines. Adding someone twice is harmless.
                        </p>
                        <textarea
                            value={raw}
                            onChange={(e) => setRaw(e.target.value)}
                            rows={6}
                            placeholder={"sara@example.com\nmike@example.com"}
                            className="w-full rounded-lg border border-neutral-600 bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder focus:outline-none"
                        />
                        <p className="text-sm text-tertiary">
                            {emails.length} {emails.length === 1 ? "address" : "addresses"}
                        </p>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                        <div className="mt-2 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={submit}
                                disabled={busy || emails.length === 0}
                                className={PRIMARY_BTN}
                            >
                                {busy ? <Spinner size="sm" tone="on-brand" /> : `Add ${emails.length || ""}`.trim()}
                            </button>
                            <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BTN}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
