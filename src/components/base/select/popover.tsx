import type { RefAttributes } from "react";
import type { PopoverProps as AriaPopoverProps } from "react-aria-components";
import { Popover as AriaPopover } from "react-aria-components";
import { cx } from "@/utils/cx";

interface PopoverProps extends AriaPopoverProps, RefAttributes<HTMLElement> {
    size: "sm" | "md" | "lg";
}

export const Popover = (props: PopoverProps) => {
    return (
        <AriaPopover
            placement="bottom"
            containerPadding={0}
            offset={4}
            {...props}
            className={(state) =>
                cx(
                    "w-(--trigger-width) origin-(--trigger-anchor-point) overflow-x-hidden overflow-y-auto rounded-lg bg-primary py-1 shadow-lg ring-1 ring-secondary_alt outline-hidden will-change-transform",

                    state.isEntering &&
                        "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                    state.isExiting &&
                        "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",

                    // Show 6 option rows before scrolling (row heights: sm 38, md 42, lg 46,
                    // plus the popover's py-1). ≤6 items fit with no scrollbar; 7+ scroll.
                    props.size === "sm" && "max-h-[236px]!",
                    props.size === "md" && "max-h-[260px]!",
                    props.size === "lg" && "max-h-[284px]!",

                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        />
    );
};
