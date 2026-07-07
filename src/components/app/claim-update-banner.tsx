import { X } from "@untitledui/icons";
import type { MyClaim } from "@/types/activity";

function formatWhen(gameDate: string | null, gameTime: string | null): string {
    const parts: string[] = [];
    if (gameDate) parts.push(new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }));
    if (gameTime) {
        const [h, m] = gameTime.split(":");
        const hour = parseInt(h, 10);
        parts.push(`${hour % 12 || 12}:${m}${hour >= 12 ? "pm" : "am"}`);
    }
    return parts.join(" ");
}

interface ClaimUpdateBannerProps {
    claim: MyClaim;
    status: "approved" | "rejected";
    onDismiss: () => void;
    /** Optional detail action (approved claims open the claim sheet). */
    onView?: () => void;
}

/** Feed banner shown to the claimer when their claim is approved or declined. */
export function ClaimUpdateBanner({ claim, status, onDismiss, onView }: ClaimUpdateBannerProps) {
    const when = formatWhen(claim.game_date, claim.game_time);
    const court = claim.location ?? claim.custom_court;
    const where = [when && `for ${when}`, court && `at ${court}`].filter(Boolean).join(" ");
    const approved = status === "approved";

    return (
        <div className="relative rounded-lg bg-brand-800 p-4">
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded p-0.5 text-tertiary transition duration-100 ease-linear hover:text-secondary"
            >
                <X className="size-4" aria-hidden="true" />
            </button>

            <p className="pr-6 text-sm font-semibold text-primary">{approved ? "Claim approved!" : "Claim not approved"}</p>
            <p className="mt-1 text-sm text-secondary">
                {approved
                    ? `Your claim${where ? ` ${where}` : ""} was approved. Open it to coordinate and pay.`
                    : `Your claim${where ? ` ${where}` : ""} wasn't approved.`}
            </p>

            <div className="mt-3 flex items-center gap-3">
                <button
                    type="button"
                    onClick={onDismiss}
                    className="text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    Dismiss
                </button>
                {onView && (
                    <button
                        type="button"
                        onClick={onView}
                        className="text-sm font-semibold text-brand-500 transition duration-100 ease-linear hover:text-brand-600"
                    >
                        View
                    </button>
                )}
            </div>
        </div>
    );
}
