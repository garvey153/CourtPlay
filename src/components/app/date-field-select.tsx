import { useEffect, useRef, useState } from "react";
import { getLocalTimeZone } from "@internationalized/date";
import { useDateFormatter } from "react-aria";
import type { DateValue } from "react-aria-components";
import { Calendar } from "@/components/application/date-picker/calendar";
import { cx } from "@/utils/cx";

interface DateFieldSelectProps {
    value: DateValue | null;
    onChange: (value: DateValue | null) => void;
    minValue?: DateValue;
    isDisabled?: boolean;
    "aria-label"?: string;
    /** Applied to the field container (e.g. width). */
    className?: string;
}

/**
 * A date field that shows the value as MM/DD/YYYY (styled like the feed-filters date
 * inputs) and opens a calendar below it on click. Uses a plain absolute-positioned
 * dropdown (not a modal popover) so the page keeps scrolling while it's open and the
 * calendar follows the field. Calendar styling per the CourtPlay design: bg-primary
 * surface, secondary_alt ring (matches other menus); selected day + today dot match
 * the feed-filters calendar (shared CalendarCell: brand-solid selected day).
 */
export function DateFieldSelect({ value, onChange, minValue, isDisabled, className, ...props }: DateFieldSelectProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    // 2-digit month/day + numeric year → MM/DD/YYYY for en-US.
    const formatter = useDateFormatter({ month: "2-digit", day: "2-digit", year: "numeric" });
    const formatted = value ? formatter.format(value.toDate(getLocalTimeZone())) : null;

    // Close on outside pointer or Escape.
    useEffect(() => {
        if (!open) return;
        const onPointer = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cx("relative", className)}>
            {/* bg-tertiary matches the form's other fields; ring stays neutral-600 in every state (no green on focus). */}
            <button
                type="button"
                aria-label={props["aria-label"] ?? "Date"}
                aria-expanded={open}
                disabled={isDisabled}
                onClick={() => !isDisabled && setOpen((o) => !o)}
                className="flex h-9 w-full cursor-pointer items-center rounded-lg bg-tertiary px-3 text-sm shadow-xs outline-hidden ring-1 ring-neutral-600 transition duration-100 ease-linear ring-inset disabled:cursor-not-allowed disabled:opacity-50"
            >
                <span className={cx("truncate", formatted ? "text-primary" : "text-placeholder")}>{formatted ?? "MM/DD/YYYY"}</span>
            </button>

            {open && (
                // Always below the field; absolute (not a modal popover) so the page still
                // scrolls and the calendar tracks the field. bg-primary + secondary_alt ring
                // match the other dropdown menus; selected day + today dot come from the
                // shared CalendarCell (same as the feed-filters calendar).
                <div className="absolute top-full left-0 z-40 mt-2 rounded-lg bg-primary px-6 py-5 shadow-xl ring-1 ring-secondary_alt">
                    <Calendar
                        aria-label={props["aria-label"] ?? "Date"}
                        value={value}
                        minValue={minValue}
                        onChange={(v) => {
                            onChange(v);
                            setOpen(false);
                        }}
                        autoFocus
                    >
                        {/* Empty fragment overrides the default date-input + Today row so only the calendar shows. */}
                        {<></>}
                    </Calendar>
                </div>
            )}
        </div>
    );
}
