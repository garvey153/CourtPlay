import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { describeActionError } from "@/utils/load-error";
import { sendInvite } from "@/lib/invite";

interface SeedResult {
    submitted: number;
    inserted: number;
    already_there: number;
    rejected: string[];
    total_invited: number;
    /** Filled in by this component after the emails go out. */
    emailed?: number;
    failed?: string[];
}

/**
 * Paste a list of emails onto the invite list, and invite them.
 *
 * Adding used to only write the rows, leaving the email as a second trip through
 * a different sheet. That reliably produced a beta nobody had been told about:
 * the addresses could sign up and none of them knew. Add now does both.
 *
 * A list pasted from a spreadsheet is the shape this has to accept, so it splits
 * on commas, semicolons, whitespace and newlines alike.
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

        // The list first. If this fails nothing was promised to anyone, and the
        // addresses are still only in the box.
        const { data, error: rpcError } = await supabase.rpc("admin_seed_invites", { p_emails: emails });
        if (rpcError) {
            setBusy(false);
            setError(describeActionError(rpcError, "add those invites"));
            return;
        }
        const seeded = data as SeedResult;

        // Then the emails. Anything the server called malformed is skipped rather
        // than mailed into the void. Addresses already on the list are still sent
        // to — pasting someone again is how you resend.
        const rejected = new Set((seeded.rejected ?? []).map((r) => r.toLowerCase()));
        const sendTo = [...new Set(emails.map((e) => e.trim().toLowerCase()))].filter((e) => !rejected.has(e));

        const failed: string[] = [];
        let emailed = 0;
        // Sequential on purpose: a paste of thirty firing at once is a burst at
        // the mail provider, and the spinner is already showing.
        for (const address of sendTo) {
            const outcome = await sendInvite(address);
            if (outcome.ok) emailed += 1;
            else failed.push(address);
        }

        setBusy(false);
        setResult({ ...seeded, emailed, failed });
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
                        {result ? "Invites sent" : "Add players to the beta"}
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
                        {/* Say what was actually sent. The old copy told you
                            emailing was a separate step, which was true and still
                            produced a beta nobody had been told about. */}
                        {(result.failed?.length ?? 0) > 0 ? (
                            <div className="rounded-lg bg-tertiary p-3">
                                <p className="text-sm font-semibold text-primary">
                                    {result.failed!.length} invite {result.failed!.length === 1 ? "email" : "emails"}{" "}
                                    didn&apos;t send
                                </p>
                                <p className="mt-1 break-words text-sm text-secondary">{result.failed!.join(", ")}</p>
                                <p className="mt-1 text-sm text-tertiary">
                                    They&apos;re on the list and can still sign up — tell them directly, or try again.
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-tertiary">
                                {result.emailed === 1
                                    ? "Invite email sent. They can create an account from the link."
                                    : `${result.emailed} invite emails sent. They can create an account from the link.`}
                            </p>
                        )}
                        <button type="button" onClick={onClose} className={PRIMARY_BTN}>
                            Done
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-secondary">
                            Paste addresses separated by commas. We'll email each one a link to create an account.
                        </p>
                        {/* The parser still splits on spaces and new lines too, so a
                            pasted column keeps working — commas are just the one
                            convention worth telling people about. */}
                        <textarea
                            value={raw}
                            onChange={(e) => setRaw(e.target.value)}
                            rows={6}
                            placeholder={"sara@example.com, mike@example.com"}
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
                                {/* Always "Add" — the count lives on its own line
                                    above, and a label that changes width as you
                                    type reads as the button doing something. */}
                                {busy ? <Spinner size="sm" tone="on-brand" /> : "Add"}
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
