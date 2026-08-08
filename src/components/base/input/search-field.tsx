import { SearchSm, XClose } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /**
     * Chosen by the SURFACE behind the field, not by taste:
     *
     *   outline — on the darker page background (bg-primary)
     *   filled  — on lighter elevated surfaces (bg-secondary): bottom sheets,
     *             modals, and the onboarding page
     *
     * An outline on bg-secondary all but disappears, and a fill on bg-primary
     * is louder than the page wants. Getting this wrong is the most likely way
     * to misuse the component, which is why it has no sensible default beyond
     * the commoner case.
     */
    variant?: "outline" | "filled";
    /** For layout only — admin rows put the field beside an add button (flex-1). */
    className?: string;
    /** Set when there is no visible label near the field. */
    "aria-label"?: string;
    id?: string;
    /** Onboarding reopens its typeahead when focus returns to a non-empty field. */
    onFocus?: () => void;
}

/**
 * Figma's token NAMES do not map to this app's, so these are pinned by measured
 * value rather than by matching names — which is how the wrong border got in
 * here first time round:
 *
 *   Figma border/tertiary  #4d5f53  ->  neutral-600   (border-tertiary is #26382c)
 *   Figma border/primary   #26382c  ->  border-secondary
 *
 * Outline keeps `border-primary` (#394c3f) rather than the design's #26382c:
 * every outline field already in the app uses it, and matching what shipped was
 * the instruction. That is a deliberate one-step difference from the design.
 */
const VARIANTS = {
    // design-system 612:1775 (variant 3)
    outline: "border-primary",
    // design-system 300:820 / 411:795 (default / variant 2)
    filled: "bg-tertiary border-neutral-600",
} as const;

/**
 * The one search field.
 *
 * There were nine hand-rolled copies before this, no two quite alike — seven at
 * a 24×24 icon and two at the design's 20×20, across three different border
 * colours. Everything here comes from design-system 407:765 except the clear
 * button, which the design draws at 10×10: both shipped implementations used
 * 20×20, and 10px is below a usable touch target, so that one stays.
 *
 * It renders the FIELD only. Callers that anchor an absolutely-positioned
 * typeahead to it keep their own `relative` wrapper — onboarding's outside-click
 * handler reads a ref on exactly that element, and a wrapper introduced in here
 * would silently break it.
 */
export function SearchField({
    value,
    onChange,
    placeholder,
    variant = "outline",
    className,
    "aria-label": ariaLabel,
    id,
    onFocus,
}: SearchFieldProps) {
    return (
        <div className={cx("flex h-9 items-center gap-2 rounded-lg border px-3 shadow-xs", VARIANTS[variant], className)}>
            <SearchSm className="size-5 shrink-0 text-tertiary" strokeWidth={1} aria-hidden="true" />
            <input
                id={id}
                aria-label={ariaLabel}
                className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                autoComplete="off"
            />
            {value && (
                <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onChange("")}
                    className="shrink-0 text-tertiary transition duration-100 ease-linear hover:text-primary"
                >
                    <XClose className="size-5" strokeWidth={1} />
                </button>
            )}
        </div>
    );
}
