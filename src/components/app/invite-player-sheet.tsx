import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { XClose } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { FIELD } from "@/components/base/input/field-styles";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import { PRIMARY_MD as PRIMARY_BTN, SECONDARY_MD as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { sendInvite } from "@/lib/invite";

/**
 * Invite someone who isn't on CourtPlay yet, from wherever the need came up.
 *
 * Opened from the friends search when it finds nobody — the moment a player
 * actually wants this — rather than from a separate destination they would have
 * to remember exists.
 */
export function InvitePlayerSheet({ initialEmail = "", onClose }: { initialEmail?: string; onClose: () => void }) {
    const [email, setEmail] = useState(initialEmail);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const submit = async () => {
        setSending(true);
        setError(null);
        const result = await sendInvite(email);
        setSending(false);
        if (result.ok) setSentTo(email.trim());
        else setError(result.message);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-player-title"
        >
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

            <motion.div
                className="relative flex w-full max-w-md flex-col gap-4 sheet-fill rounded-t-2xl bg-secondary px-5 pt-5 pb-[calc(2rem_+_var(--safe-bottom))] shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="invite-player-title" className="min-w-0 text-md font-semibold text-primary">
                        {sentTo ? "Invite sent" : "Invite a player"}
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

                {sentTo ? (
                    <>
                        <p className="text-sm text-secondary">
                            We've emailed <span className="font-semibold text-primary">{sentTo}</span> an invite. They
                            can join with that address.
                        </p>
                        <button type="button" onClick={onClose} className={PRIMARY_BTN}>
                            Done
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-secondary">
                            CourtPlay is invite only while we're in beta. We'll email them a link to join.
                        </p>
                        <Input
                            label="Email address"
                            type="email"
                            placeholder="jane@example.com"
                            value={email}
                            onChange={setEmail}
                            size="sm"
                            isRequired
                            wrapperClassName={FIELD}
                        />
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                        <div className="mt-2 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={submit}
                                disabled={sending || !email.trim()}
                                className={PRIMARY_BTN}
                            >
                                {sending ? <Spinner size="sm" tone="on-brand" /> : "Send invite"}
                            </button>
                            <button type="button" onClick={onClose} disabled={sending} className={SECONDARY_BTN}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
