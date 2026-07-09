import type { FC, ReactNode, Ref, RefAttributes } from "react";
import { isValidElement, useEffect, useRef, useState } from "react";
import { ChevronDown } from "@untitledui/icons";
import type { SelectProps as AriaSelectProps } from "react-aria-components";
import { Button as AriaButton, ListBox as AriaListBox, Select as AriaSelect, SelectValue as AriaSelectValue } from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import { ComboBox } from "./combobox";
import { Popover } from "./popover";
import { SelectItem } from "./select-item";
import { type CommonProps, SelectContext, type SelectItemType, sizes } from "./select-shared";

export { SelectContext, sizes, type CommonProps, type SelectItemType } from "./select-shared";

export interface SelectProps extends Omit<AriaSelectProps<SelectItemType>, "children" | "items">, RefAttributes<HTMLDivElement>, CommonProps {
    items?: SelectItemType[];
    popoverClassName?: string;
    /**
     * Render the menu non-modally so the page keeps scrolling while it's open (like the
     * date calendar). Closing on outside/other-field is handled manually.
     */
    isNonModal?: boolean;
    /** Extra classes on the trigger button (e.g. to recolor its surface). */
    triggerClassName?: string;
    /** Inline style for the trigger button (e.g. an explicit width). */
    triggerStyle?: React.CSSProperties;
    icon?: FC | ReactNode;
    children: ReactNode | ((item: SelectItemType) => ReactNode);
}

interface SelectValueProps {
    isOpen: boolean;
    size: "sm" | "md" | "lg";
    isFocused: boolean;
    isDisabled: boolean;
    placeholder?: string;
    ref?: Ref<HTMLButtonElement>;
    icon?: FC | ReactNode;
    triggerClassName?: string;
    triggerStyle?: React.CSSProperties;
}

const SelectValue = ({ isOpen, isFocused, isDisabled, size, placeholder, icon, ref, triggerClassName, triggerStyle }: SelectValueProps) => {
    return (
        <AriaButton
            ref={ref}
            style={triggerStyle}
            className={cx(
                "relative flex w-full cursor-pointer items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary outline-hidden transition duration-100 ease-linear ring-inset",
                (isFocused || isOpen) && "ring-2 ring-brand",
                isDisabled && "cursor-not-allowed opacity-50",
                triggerClassName,
            )}
        >
            <AriaSelectValue<SelectItemType>
                className={(state) =>
                    cx(
                        "flex h-max w-full items-center justify-start truncate text-left align-middle",

                        sizes[size].root,

                        // With icon
                        (state.selectedItems[0]?.icon || icon) && sizes[size].withIcon,

                        // Icon styles
                        "*:data-icon:shrink-0 *:data-icon:text-fg-quaternary",
                    )
                }
            >
                {(state) => {
                    const selectedItem = state.selectedItems[0];
                    const Icon = selectedItem?.icon || icon;

                    return (
                        <>
                            {selectedItem?.avatarUrl ? (
                                <Avatar size="xs" src={selectedItem.avatarUrl} alt={selectedItem.label} className={cx(size === "sm" && "size-5")} />
                            ) : isReactComponent(Icon) ? (
                                <Icon data-icon aria-hidden="true" />
                            ) : isValidElement(Icon) ? (
                                Icon
                            ) : null}

                            {selectedItem ? (
                                <section className={cx("flex w-full truncate", sizes[size].textContainer)}>
                                    <p className={cx("truncate font-medium text-primary", sizes[size].text)}>{selectedItem?.label}</p>
                                    {selectedItem?.supportingText && <p className={cx("text-tertiary", sizes[size].text)}>{selectedItem?.supportingText}</p>}
                                </section>
                            ) : (
                                <p className={cx("text-placeholder", sizes[size].text)}>{placeholder}</p>
                            )}

                            <ChevronDown
                                aria-hidden="true"
                                className={cx("ml-auto shrink-0 text-fg-quaternary", size === "lg" ? "size-5" : "size-4 stroke-[2.25px]")}
                            />
                        </>
                    );
                }}
            </AriaSelectValue>
        </AriaButton>
    );
};

const Select = ({ placeholder = "Select", icon, size = "md", children, items, label, hint, tooltip, hideRequiredIndicator, className, triggerClassName, triggerStyle, isNonModal, ...rest }: SelectProps) => {
    // When non-modal, control the open state so we can close on outside/other-field clicks
    // (react-aria doesn't dismiss non-modal popovers on outside pointer interaction).
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isNonModal || !open) return;
        const onDown = (e: PointerEvent) => {
            const t = e.target as Element | null;
            // Ignore clicks on the trigger (this select's root) or inside any option list.
            if (rootRef.current?.contains(t as Node) || t?.closest?.("[role=listbox]")) return;
            setOpen(false);
        };
        // Capture phase so it beats react-aria's own press handling on other fields.
        document.addEventListener("pointerdown", onDown, true);
        return () => document.removeEventListener("pointerdown", onDown, true);
    }, [isNonModal, open]);

    const openProps = isNonModal ? { isOpen: open, onOpenChange: setOpen } : {};

    return (
        <SelectContext.Provider value={{ size }}>
            <AriaSelect
                {...rest}
                {...openProps}
                ref={isNonModal ? rootRef : rest.ref}
                className={(state) => cx("flex flex-col gap-2", typeof className === "function" ? className(state) : className)}
            >
                {(state) => (
                    <>
                        {label && (
                            <Label isRequired={hideRequiredIndicator ? false : state.isRequired} tooltip={tooltip}>
                                {label}
                            </Label>
                        )}

                        <SelectValue {...state} {...{ size, placeholder }} icon={icon} triggerClassName={triggerClassName} triggerStyle={triggerStyle} />

                        <Popover size={size} isNonModal={isNonModal} className={rest.popoverClassName}>
                            <AriaListBox items={items} className="size-full outline-hidden">
                                {children}
                            </AriaListBox>
                        </Popover>

                        {hint && (
                            <HintText isInvalid={state.isInvalid} className={cx(size === "sm" && "text-xs")}>
                                {hint}
                            </HintText>
                        )}
                    </>
                )}
            </AriaSelect>
        </SelectContext.Provider>
    );
};

const _Select = Select as typeof Select & {
    ComboBox: typeof ComboBox;
    Item: typeof SelectItem;
};
_Select.ComboBox = ComboBox;
_Select.Item = SelectItem;

export { _Select as Select };
