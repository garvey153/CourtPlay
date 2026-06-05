import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@/components/base/input/input";

const meta = {
    title: "Base/Input",
    component: Input,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md", "lg"] },
    },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        placeholder: "Enter text...",
    },
};

export const WithLabel: Story = {
    args: {
        label: "Email",
        placeholder: "olivia@untitledui.com",
    },
};

export const WithHint: Story = {
    args: {
        label: "Email",
        placeholder: "olivia@untitledui.com",
        hint: "This is a hint text to help the user.",
    },
};

export const WithError: Story = {
    args: {
        label: "Email",
        placeholder: "olivia@untitledui.com",
        isInvalid: true,
        hint: "Please enter a valid email address.",
    },
};

export const Disabled: Story = {
    args: {
        label: "Email",
        placeholder: "olivia@untitledui.com",
        isDisabled: true,
    },
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex flex-col gap-4 max-w-sm">
            <Input size="sm" label="Small" placeholder="Small input" />
            <Input size="md" label="Medium" placeholder="Medium input" />
            <Input size="lg" label="Large" placeholder="Large input" />
        </div>
    ),
};

export const Required: Story = {
    args: {
        label: "Email",
        placeholder: "olivia@untitledui.com",
        isRequired: true,
    },
};
