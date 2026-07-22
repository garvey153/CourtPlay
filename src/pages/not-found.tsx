import { ArrowLeft } from "@untitledui/icons";
import { useNavigate } from "react-router";

// Shared button styles, matching the auth / landing CTAs (green with dark on-brand text).
const PRIMARY_BTN =
    "flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition duration-100 ease-linear hover:bg-brand-600";
const SECONDARY_BTN =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-tertiary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:text-primary";

export function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-5 py-12 text-center">
            <div className="flex w-full max-w-sm flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2.5">
                    <span className="text-sm font-semibold text-brand-500">404 error</span>
                    <h1 className="text-display-sm font-semibold text-primary">Out of bounds</h1>
                    <p className="text-sm text-secondary">
                        That page landed outside the lines — it doesn't exist or has moved. Let's get you back on the court.
                    </p>
                </div>

                <div className="flex w-full flex-col gap-3">
                    <button type="button" onClick={() => navigate("/feed")} className={PRIMARY_BTN}>
                        Take me home
                    </button>
                    <button type="button" onClick={() => navigate(-1)} className={SECONDARY_BTN}>
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Go back
                    </button>
                </div>
            </div>
        </div>
    );
}
