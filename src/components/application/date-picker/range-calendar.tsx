import type { HTMLAttributes, PropsWithChildren } from "react";
import { Fragment, useContext, useEffect, useState } from "react";
import type { CalendarDate } from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import { useDateFormatter } from "react-aria";
import type { RangeCalendarProps as AriaRangeCalendarProps, DateValue } from "react-aria-components";
import {
    CalendarGrid as AriaCalendarGrid,
    CalendarGridBody as AriaCalendarGridBody,
    CalendarGridHeader as AriaCalendarGridHeader,
    CalendarHeaderCell as AriaCalendarHeaderCell,
    DateField as AriaDateField,
    RangeCalendar as AriaRangeCalendar,
    RangeCalendarContext,
    RangeCalendarStateContext,
    useSlottedContext,
} from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { InputDateBase } from "@/components/base/input/input-date";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";
import { CalendarCell } from "./cell";

export const RangeCalendarContextProvider = ({ children }: PropsWithChildren) => {
    const [value, onChange] = useState<{ start: DateValue; end: DateValue } | null>(null);
    const [focusedValue, onFocusChange] = useState<DateValue | undefined>();

    return <RangeCalendarContext.Provider value={{ value, onChange, focusedValue, onFocusChange }}>{children}</RangeCalendarContext.Provider>;
};

// Segment styling: tight spacing, "/" primary when filled and placeholder while empty.
const DATE_FIELD_SEGMENTS = "[&_[data-type]]:px-0 [&_[data-type=literal]]:text-primary has-[[data-placeholder]]:[&_[data-type=literal]]:text-placeholder";

/** The two range date fields — editable (type-to-edit) and wired to the calendar state so
 *  the start shows as soon as the first date is picked (anchorDate), before the range completes. */
const RangeDateFields = () => {
    const state = useContext(RangeCalendarStateContext);

    // Each field is buffered in local state and synced FROM the calendar via effects keyed on
    // the (stable) date string. Deriving the controlled value live from `state` instead makes a
    // commit to one field re-render the other and steal focus mid-type; buffering avoids that.
    const [start, setStart] = useState<DateValue | null>(null);
    const [end, setEnd] = useState<DateValue | null>(null);

    // While selecting, anchorDate holds the first-picked date; value fills in once complete.
    // End reads value.end directly (never keyed off anchorDate) so it doesn't blip to null on commit.
    const calStart = state?.anchorDate ?? state?.value?.start ?? null;
    const calEnd = state?.value?.end ?? null;
    const calStartKey = calStart?.toString() ?? "";
    const calEndKey = calEnd?.toString() ?? "";

    useEffect(() => setStart(calStart), [calStartKey]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => setEnd(calEnd), [calEndKey]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!state) return null;

    const commitStart = (d: DateValue | null) => {
        setStart(d);
        if (!d) return;
        // Complete the range if a valid end already exists; otherwise anchor the start on the calendar.
        if (end && d.compare(end) <= 0) {
            state.setValue({ start: d, end });
            state.setAnchorDate(null);
        } else {
            state.setAnchorDate(d as CalendarDate);
            state.setFocusedDate(d as CalendarDate);
        }
    };
    const commitEnd = (d: DateValue | null) => {
        setEnd(d);
        if (!d) return;
        // Only complete the range when a valid start exists. With no start yet, keep the typed end
        // locally and leave the calendar untouched — anchoring here would mirror into the start field.
        if (start && d.compare(start) >= 0) {
            state.setValue({ start, end: d });
            state.setAnchorDate(null);
            state.setFocusedDate(d as CalendarDate);
        }
    };

    return (
        <div className="flex items-center gap-2 md:hidden">
            <AriaDateField aria-label="Start date" value={start} onChange={commitStart} className="flex-1">
                <InputDateBase size="sm" wrapperClassName="bg-secondary ring-neutral-600" className={DATE_FIELD_SEGMENTS} />
            </AriaDateField>
            <div className="text-md text-tertiary">–</div>
            <AriaDateField aria-label="End date" value={end} onChange={commitEnd} className="flex-1">
                <InputDateBase size="sm" wrapperClassName="bg-secondary ring-neutral-600" className={DATE_FIELD_SEGMENTS} />
            </AriaDateField>
        </div>
    );
};

const RangeCalendarTitle = ({ part }: { part: "start" | "end" }) => {
    const context = useContext(RangeCalendarStateContext);

    if (!context) {
        throw new Error("<RangeCalendarTitle /> must be used within a <RangeCalendar /> component.");
    }

    const formatter = useDateFormatter({
        month: "long",
        year: "numeric",
        calendar: context.visibleRange.start.calendar.identifier,
        timeZone: context.timeZone,
    });

    return part === "start"
        ? formatter.format(context.visibleRange.start.toDate(context.timeZone))
        : formatter.format(context.visibleRange.end.toDate(context.timeZone));
};

interface RangePresetButtonProps extends HTMLAttributes<HTMLButtonElement> {
    value: { start: DateValue; end: DateValue };
}

export const RangePresetButton = ({ value, className, children, ...props }: RangePresetButtonProps) => {
    const context = useSlottedContext(RangeCalendarContext);

    const isSelected = context?.value?.start?.compare(value.start) === 0 && context?.value?.end?.compare(value.end) === 0;

    return (
        <button
            {...props}
            className={cx(
                "cursor-pointer rounded-md px-3 py-2 text-left text-sm font-medium outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2",
                isSelected ? "bg-active text-secondary_hover hover:bg-secondary_hover" : "text-secondary hover:bg-primary_hover hover:text-secondary_hover",
                className,
            )}
        >
            {children}
        </button>
    );
};

const MobilePresetButton = ({ value, children, ...props }: HTMLAttributes<HTMLButtonElement> & { value: { start: DateValue; end: DateValue } }) => {
    const context = useContext(RangeCalendarStateContext);

    return (
        <Button
            {...props}
            slot={null}
            size="sm"
            color="link-color"
            className="text-brand-500! hover:text-brand-600!"
            onClick={() => {
                // Cancel any in-progress (anchored) selection so the preset range replaces it
                // instead of leaving the calendar mid-selection.
                context?.setAnchorDate(null);
                context?.setValue(value);
                context?.setFocusedDate(value.start as CalendarDate);
            }}
        >
            {children}
        </Button>
    );
};

interface RangeCalendarProps extends AriaRangeCalendarProps<DateValue> {
    /** The dates to highlight. */
    highlightedDates?: DateValue[];
    /** The date presets to display. */
    presets?: Record<string, { label: string; value: { start: DateValue; end: DateValue } }>;
    /** Whether to show out of range dates. */
    showOutOfRangeDates?: boolean;
    /** Whether to show presets on desktop. */
    showPresetsOnDesktop?: boolean;
}

export const RangeCalendar = ({ presets, visibleDuration, showOutOfRangeDates = false, showPresetsOnDesktop = false, ...props }: RangeCalendarProps) => {
    const isDesktop = useBreakpoint("md");
    const context = useSlottedContext(RangeCalendarContext);

    const ContextWrapper = context ? Fragment : RangeCalendarContextProvider;

    const visibleDurationMonths = visibleDuration?.months || (isDesktop ? 2 : 1);

    return (
        <ContextWrapper>
            <AriaRangeCalendar
                {...props}
                className={(state) => cx("flex items-start", typeof props.className === "function" ? props.className(state) : props.className)}
                visibleDuration={{
                    months: visibleDurationMonths,
                }}
            >
                <div className="flex flex-col gap-3 px-6 py-5 md:gap-2">
                    <header className={cx("relative flex items-center", visibleDurationMonths > 1 ? "justify-start" : "justify-between")}>
                        <Button slot="previous" iconLeading={ChevronLeft} size="sm" color="tertiary" className="size-8 *:data-icon:text-tertiary!" />

                        <h2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-secondary">
                            <RangeCalendarTitle part="start" />
                        </h2>

                        {visibleDurationMonths === 1 && <Button slot="next" iconLeading={ChevronRight} size="sm" color="tertiary" className="size-8 *:data-icon:text-tertiary!" />}
                    </header>

                    {!isDesktop && <RangeDateFields />}

                    {(showPresetsOnDesktop || !isDesktop) && presets && (
                        <div className="mt-1 flex justify-between gap-3 px-2">
                            {Object.values(presets).map((preset) => (
                                <MobilePresetButton key={preset.label} value={preset.value}>
                                    {preset.label}
                                </MobilePresetButton>
                            ))}
                        </div>
                    )}

                    <AriaCalendarGrid weekdayStyle="short" className="w-full table-fixed">
                        <AriaCalendarGridHeader>
                            {(day) => (
                                <AriaCalendarHeaderCell className="border-b-4 border-transparent p-0">
                                    <div className="mx-auto flex size-10 items-center justify-center text-sm font-medium text-secondary">{day.slice(0, 2)}</div>
                                </AriaCalendarHeaderCell>
                            )}
                        </AriaCalendarGridHeader>
                        <AriaCalendarGridBody className="[&_td]:p-0 [&_tr]:border-b-4 [&_tr]:border-transparent [&_tr:last-of-type]:border-none">
                            {(date) => <CalendarCell date={date} showOutOfRangeDates={showOutOfRangeDates} />}
                        </AriaCalendarGridBody>
                    </AriaCalendarGrid>
                </div>

                {visibleDurationMonths > 1 && (
                    <div className="flex flex-col gap-3 border-l border-secondary px-6 py-5">
                        <header className="relative flex items-center justify-end">
                            <h2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-secondary">
                                <RangeCalendarTitle part="end" />
                            </h2>

                            <Button slot="next" iconLeading={ChevronRight} size="sm" color="tertiary" className="size-8 *:data-icon:text-tertiary!" />
                        </header>

                        <AriaCalendarGrid weekdayStyle="short" offset={{ months: 1 }} className="w-max">
                            <AriaCalendarGridHeader>
                                {(day) => (
                                    <AriaCalendarHeaderCell className="border-b-4 border-transparent p-0">
                                        <div className="mx-auto flex size-10 items-center justify-center text-sm font-medium text-secondary">{day.slice(0, 2)}</div>
                                    </AriaCalendarHeaderCell>
                                )}
                            </AriaCalendarGridHeader>
                            <AriaCalendarGridBody className="[&_td]:p-0 [&_tr]:border-b-4 [&_tr]:border-transparent [&_tr:last-of-type]:border-none">
                                {(date) => <CalendarCell date={date} />}
                            </AriaCalendarGridBody>
                        </AriaCalendarGrid>
                    </div>
                )}
            </AriaRangeCalendar>
        </ContextWrapper>
    );
};
