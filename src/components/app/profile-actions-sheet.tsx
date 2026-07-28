import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Flag01, XClose } from "@untitledui/icons";

interface ProfileActionsSheetProps {
    /** Open the report flow for this profile. */
    onReport: () => void;
    onClose: () => void;
}

/**
 * Bottom sheet opened from another player's profile overflow (⋮) menu. Mirrors
 * the report sheet's container — portaled to <body>, backdrop-blur, slide-up —
 * so it stays consistent with every other bottom sheet. Lists the actions
 * available on that profile (currently just: report).
 */
export function ProfileActionsSheet({ onReport, onClose }: ProfileActionsSheetProps) {
    // Close on Escape (matches the report sheet).
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[8px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Profile options"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-secondary px-5 pt-5 pb-8 shadow-xl sm:rounded-2xl"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", damping: 38, stiffness: 420 }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-quaternary transition duration-100 ease-linear hover:text-tertiary"
                >
                    <XClose className="size-5" strokeWidth={1} aria-hidden="true" />
                </button>

                <h2 className="pr-9 text-lg font-semibold text-primary">Options</h2>

                {/* Action rows use the report sheet's grouped-row treatment: bg-tertiary
                    rows with 4px gaps and only the outer corners rounded. */}
                <div className="mt-4 flex flex-col gap-1 overflow-hidden rounded-lg">
                    <button
                        type="button"
                        onClick={onReport}
                        className="flex h-11 w-full items-center gap-2.5 bg-tertiary px-3 text-left text-sm font-medium text-error-primary transition duration-100 ease-linear hover:brightness-110"
                    >
                        <Flag01 className="size-4 shrink-0" aria-hidden="true" />
                        Report this user
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
