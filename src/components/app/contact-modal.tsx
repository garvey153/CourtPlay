import { useEffect, useRef } from "react";
import { Button } from "@/components/base/buttons/button";

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

export interface ContactInfo {
    /** Role of the person whose contact is shown */
    role: "claimer" | "poster";
    firstName: string;
    lastName: string;
    phone: string | null;
    venmoHandle: string | null;
    gameDate: string | null;
    gameTime: string | null;
    location: string | null;
    cost: number | null;
    /** Viewer's perspective — "poster" = I posted, "claimer" = I claimed */
    viewerRole: "poster" | "claimer";
}

interface ContactModalProps {
    info: ContactInfo;
    onClose: () => void;
}

export function ContactModal({ info, onClose }: ContactModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (e.target === overlayRef.current) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const dateDisplay = info.gameDate ? formatDate(info.gameDate) : "Date TBD";
    const timeDisplay = info.gameTime ? formatTime(info.gameTime) : null;
    const locationDisplay = info.location ?? "TBD";

    // Build Venmo deep link (shown to poster, charging the claimer)
    const venmoHref = info.viewerRole === "poster" && info.venmoHandle && info.cost != null
        ? `venmo://paycharge?txn=charge&recipients=${encodeURIComponent(info.venmoHandle)}&amount=${info.cost.toFixed(2)}&note=${encodeURIComponent(`CourtPlay sub fee ${dateDisplay} ${locationDisplay}`)}`
        : null;

    // Web fallback if Venmo app is not installed
    const venmoFallback = info.venmoHandle
        ? `https://venmo.com/${encodeURIComponent(info.venmoHandle)}`
        : null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
        >
            <div className="w-full max-w-sm rounded-t-2xl bg-primary p-6 shadow-xl sm:rounded-2xl">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-tertiary">
                    {info.viewerRole === "poster" ? "Claimer details" : "Game details"}
                </div>
                <h2 id="contact-modal-title" className="text-lg font-semibold text-primary">
                    {info.firstName} {info.lastName}
                </h2>

                {/* Game summary */}
                <div className="mt-3 space-y-0.5 text-sm text-secondary">
                    <p>{locationDisplay}</p>
                    <p>
                        {dateDisplay}
                        {timeDisplay && <span className="text-tertiary"> · {timeDisplay}</span>}
                    </p>
                    {info.cost != null && (
                        <p className="font-semibold text-primary">${info.cost.toFixed(2)}</p>
                    )}
                </div>

                <hr className="my-4 border-secondary" />

                {/* Contact */}
                <div className="space-y-2 text-sm">
                    {info.phone ? (
                        <div className="flex items-center justify-between">
                            <span className="text-tertiary">Phone</span>
                            <a
                                href={`tel:${info.phone}`}
                                className="font-medium text-brand-secondary underline underline-offset-2"
                            >
                                {info.phone}
                            </a>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="text-tertiary">Phone</span>
                            <span className="text-tertiary">Not provided</span>
                        </div>
                    )}

                    {info.venmoHandle && (
                        <div className="flex items-center justify-between">
                            <span className="text-tertiary">Venmo</span>
                            <span className="font-medium text-primary">@{info.venmoHandle}</span>
                        </div>
                    )}
                </div>

                {/* Venmo CTA for poster — tries app deep link, falls back to web */}
                {venmoHref && (
                    <div className="mt-4 flex flex-col gap-2">
                        <a
                            href={venmoHref}
                            className="flex w-full items-center justify-center rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-solid_hover"
                        >
                            Request payment via Venmo
                        </a>
                        {venmoFallback && (
                            <a
                                href={venmoFallback}
                                className="text-center text-xs text-brand-secondary underline underline-offset-2"
                            >
                                Open Venmo on web instead
                            </a>
                        )}
                    </div>
                )}

                {/* Pay reminder for claimer */}
                {info.viewerRole === "claimer" && info.cost != null && info.venmoHandle && (
                    <p className="mt-3 text-center text-xs text-tertiary">
                        Remember to pay <span className="font-semibold text-secondary">@{info.venmoHandle}</span>{" "}
                        <span className="font-semibold text-primary">${info.cost.toFixed(2)}</span> via Venmo.
                    </p>
                )}

                <Button
                    color="secondary"
                    size="md"
                    className="mt-4 w-full"
                    onClick={onClose}
                >
                    Done
                </Button>
            </div>
        </div>
    );
}
