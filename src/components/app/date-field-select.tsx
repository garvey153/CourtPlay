import { getLocalTimeZone } from "@internationalized/date";
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
    "aria-label"?: string;
    /** Applied to the field container (e.g. width). */
    className?: string;
}

/**
 * A date field that shows the value as MM/DD/YYYY (styled like the feed-filters date
 * inputs) and opens a calendar popover on click. The border stays neutral on focus.
 * Calendar styling per the CourtPlay design: bg-primary surface, neutral-600 selected
 * day; the popover always opens below the field.
 */
export function DateFieldSelect({ value, onChange, minValue, isDisabled, className, ...props }: DateFieldSelectProps) {
    // 2-digit month/day + numeric year → MM/DD/YYYY for en-US.
    const formatter = useDateFormatter({ month: "2-digit", day: "2-digit", year: "numeric" });
    const formatted = value ? formatter.format(value.toDate(getLocalTimeZone())) : null;

    return (
        <AriaDatePicker
            aria-label={props["aria-label"] ?? "Date"}
            value={value}
            onChange={onChange}
            minValue={minValue}
            isDisabled={isDisabled}
            shouldCloseOnSelect
            className={cx("flex flex-col", className)}
        >
            <AriaGroup>
                {/* bg-tertiary matches the form's other fields; ring stays neutral-600 in every state (no green on focus/open). */}
                <AriaButton className="flex h-9 w-full cursor-pointer items-center rounded-lg bg-tertiary px-3 text-sm shadow-xs outline-hidden ring-1 ring-neutral-600 transition duration-100 ease-linear ring-inset disabled:cursor-not-allowed disabled:opacity-50">
                    <span className={cx("truncate", formatted ? "text-primary" : "text-placeholder")}>{formatted ?? "MM/DD/YYYY"}</span>
                </AriaButton>
            </AriaGroup>

            <AriaPopover
                offset={8}
                placement="bottom left"
                shouldFlip={false}
                className={({ isEntering, isExiting }) =>
                    cx(
                        "origin-(--trigger-anchor-point) will-change-transform",
                        isEntering && "duration-150 ease-out animate-in fade-in slide-in-from-top-0.5",
                        isExiting && "duration-100 ease-in animate-out fade-out slide-out-to-top-0.5",
                    )
                }
            >
                {/* bg-primary + ring-secondary_alt match the other dropdown menus; neutral-600 selected day per the design. */}
                <AriaDialog
                    aria-label="Calendar"
                    className="rounded-lg bg-primary px-6 py-5 shadow-xl ring-1 ring-secondary_alt outline-hidden [&_[data-selected]>div]:bg-neutral-600!"
                >
                    {/* Empty fragment overrides the default date-input + Today row so only the calendar shows. */}
                    <Calendar>{<></>}</Calendar>
                </AriaDialog>
            </AriaPopover>
        </AriaDatePicker>
    );
}
