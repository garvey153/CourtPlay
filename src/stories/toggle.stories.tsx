import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toggle } from "@/components/base/toggle/toggle";

const meta = {
    title: "Base/Toggle",
    component: Toggle,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md"] },
    },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {},
};

export const WithLabel: Story = {
    args: {
        label: "Enable notifications",
    },
};

export const Disabled: Story = {
    args: {
        label: "Disabled toggle",
        isDisabled: true,
    },
};

export const Small: Story = {
    args: {
        label: "Small toggle",
        size: "sm",
    },
};

export const Selected: Story = {
    args: {
        label: "Active toggle",
        isSelected: true,
    },
};
