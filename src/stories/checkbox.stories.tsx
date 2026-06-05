import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "@/components/base/checkbox/checkbox";

const meta = {
    title: "Base/Checkbox",
    component: Checkbox,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md"] },
    },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {},
};

export const WithLabel: Story = {
    args: {
        label: "Remember me",
    },
};

export const WithHint: Story = {
    args: {
        label: "Remember me",
        hint: "Save my login details for next time.",
    },
};

export const Disabled: Story = {
    args: {
        label: "Disabled checkbox",
        isDisabled: true,
    },
};

export const Indeterminate: Story = {
    args: {
        label: "Select all",
        isIndeterminate: true,
    },
};

export const Selected: Story = {
    args: {
        label: "Accepted terms",
        isSelected: true,
    },
};
