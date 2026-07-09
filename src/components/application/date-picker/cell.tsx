import { getDayOfWeek, getLocalTimeZone, isToday } from "@internationalized/date";
import type { CalendarCellProps as AriaCalendarCellProps } from "react-aria-components";
import { CalendarCell as AriaCalendarCell, RangeCalendarContext, useLocale, useSlottedContext } from "react-aria-components";
import { cx } from "@/utils/cx";

interface CalendarCellProps extends AriaCalendarCellProps {
    /** Whether the calendar is a range calendar. */
    isRangeCalendar?: boolean;
    /** Whether the cell is highlighted. */
    isHighlighted?: boolean;
    /** Whether to show out of range dates. */
    showOutOfRangeDates?: boolean;
}

export const CalendarCell = ({ date, isHighlighted, showOutOfRangeDates = false, ...props }: CalendarCellProps) => {
    const { locale } = useLocale();
    const dayOfWeek = getDayOfWeek(date, locale);
    const rangeCalendarContext = useSlottedContext(RangeCalendarContext);

    const isRangeCalendar = !!rangeCalendarContext;

    const isTodayDate = isToday(date, getLocalTimeZone());

    // Cap the range at month boundaries so a cross-month range rounds on each month's edge.
    const isFirstDayOfMonth = date.day === 1;
    const isLastDayOfMonth = date.day === new Date(date.year, date.month, 0).getDate();

    return (
        <AriaCalendarCell
            {...props}
            date={date}
            className={({ isDisabled, isFocusVisible, isOutsideMonth }) =>
                cx(
                    "relative h-10 w-full focus:outline-hidden",
                    isDisabled ? "pointer-events-none" : "cursor-pointer",
                    isFocusVisible ? "z-10" : "z-0",
                    isOutsideMonth && "opacity-50",
                    isRangeCalendar && isOutsideMonth && !showOutOfRangeDates && "hidden",
                )
            }
        >
            {({ isDisabled, isFocusVisible, isSelectionStart, isSelectionEnd, isSelected, isOutsideMonth, formattedDate }) => {
                const markedAsSelected = isSelectionStart || isSelectionEnd || (isSelected && !isDisabled && !isRangeCalendar);
                const isSingleSelection = isSelectionStart && isSelectionEnd;
                // The range bar sits behind the circle: right half on the start day, left half on the
                // end day, and the full column for days in between — so it never spills past the end circles.
                // Skip out-of-month days so a cross-month range caps at each month's edge.
                const showRangeBar = isSelected && isRangeCalendar && !isSingleSelection && !isOutsideMonth;
                const leftCap = isSelectionStart || isFirstDayOfMonth || dayOfWeek === 0;
                const rightCap = isSelectionEnd || isLastDayOfMonth || dayOfWeek === 6;

                return (
                    <>
                        {showRangeBar && (
                            <div
                                className={cx(
                                    "absolute inset-y-0 bg-neutral-600",
                                    // Cap the segment at the centered 40px circle (calc(50%-20px) aligns on
                                    // Su/Sa and month edges too); fill to the column edge on the connecting side.
                                    leftCap ? "left-[calc(50%-20px)] rounded-l-full" : "left-0",
                                    rightCap ? "right-[calc(50%-20px)] rounded-r-full" : "right-0",
                                )}
                            />
                        )}
                        <div
                            data-today-cell={!isSelected && isTodayDate ? true : undefined}
                            className={cx(
                                "relative z-10 mx-auto flex size-10 items-center justify-center rounded-full text-sm text-secondary hover:text-secondary_hover",
                                // Disabled state.
                                isDisabled && "text-secondary/50",
                                // Focus ring, visible while the cell has keyboard focus.
                                isFocusVisible ? "outline-2 outline-offset-2 outline-focus-ring" : "",
                                // Hover state for cells in the middle of the range.
                                isSelected && !isDisabled && isRangeCalendar ? "font-medium" : "",
                                markedAsSelected && "bg-brand-solid font-medium text-white hover:bg-brand-solid_hover hover:text-white",
                                // Hover state for non-selected cells.
                                !isSelected && !isDisabled ? "hover:bg-primary_hover hover:font-medium!" : "",
                                !isSelected && isTodayDate ? "bg-neutral-600 font-medium text-white" : "",
                            )}
                        >
                            {formattedDate}

                            {(isHighlighted || isTodayDate) && (
                                <div
                                    className={cx(
                                        "absolute bottom-1 left-1/2 size-1.25 -translate-x-1/2 rounded-full",
                                        markedAsSelected ? "bg-fg-white" : "bg-fg-brand-primary",
                                        isDisabled && "opacity-50",
                                    )}
                                />
                            )}
                        </div>
                    </>
                );
            }}
        </AriaCalendarCell>
    );
};
