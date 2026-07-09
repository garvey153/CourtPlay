import { getLocalTimeZone } from "@internationalized/date";
import { Calendar as CalendarIcon } from "@untitledui/icons";
import { useDateFormatter } from "react-aria";
import type { DateValue } from "react-aria-components";
import {
    Button as AriaButton,
    DatePicker as AriaDatePicker,
    Dialog as AriaDialog,
    Group as AriaGroup,
    Popover as AriaPopover,
} from "react-aria-components";
import { Calendar } from "@/components/application/date-picker/calendar";
import { cx } from "@/utils/cx";

interface DateFieldSelectProps {
    value: DateValue | null;
    onChange: (value: DateValue | null) => void;
    minValue?: DateValue;
    isDisabled?: boolean;
    placeholder?: string;
    "aria-label"?: string;
    /** Applied to the trigger button (e.g. width). */
    className?: string;
}

/**
 * A date field that opens a calendar popover on click — styled like the form's
 * other dropdowns (bg-tertiary trigger + menu). Calendar layout per design 486-1167.
 */
export function DateFieldSelect({ value, onChange, minValue, isDisabled, placeholder = "Select date", className, ...props }: DateFieldSelectProps) {
    const formatter = useDateFormatter({ month: "short", day: "numeric", year: "numeric" });
    const formatted = value ? formatter.format(value.toDate(getLocalTimeZone())) : null;

    return (
        <AriaDatePicker
            aria-label={props["aria-label"] ?? "Date"}
            value={value}
            onChange={onChange}
            minValue={minValue}
            isDisabled={isDisabled}
            shouldCloseOnSelect
            className="group flex flex-col"
        >
            <AriaGroup>
                <AriaButton
                    className={cx(
                        "flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-tertiary px-3 text-sm shadow-xs outline-hidden ring-1 ring-neutral-600 transition duration-100 ease-linear ring-inset",
                        "group-data-[open]:ring-2 group-data-[open]:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                >
                    <span className={cx("flex-1 truncate text-left", formatted ? "text-primary" : "text-placeholder")}>{formatted ?? placeholder}</span>
                    <CalendarIcon className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                </AriaButton>
            </AriaGroup>

            <AriaPopover
                offset={8}
                placement="bottom left"
                className={({ isEntering, isExiting }) =>
                    cx(
                        "origin-(--trigger-anchor-point) will-change-transform",
                        isEntering && "duration-150 ease-out animate-in fade-in placement-bottom:slide-in-from-top-0.5",
                        isExiting && "duration-100 ease-in animate-out fade-out placement-bottom:slide-out-to-top-0.5",
                    )
                }
            >
                {/* bg-tertiary + ring match the form's field/menu surface; layout per design 486-1167. */}
                <AriaDialog aria-label="Calendar" className="rounded-lg bg-tertiary px-6 py-5 shadow-xl ring-1 ring-neutral-600 outline-hidden">
                    {/* Empty fragment overrides the default date-input + Today row so only the calendar shows. */}
                    <Calendar>{<></>}</Calendar>
                </AriaDialog>
            </AriaPopover>
        </AriaDatePicker>
    );
}
