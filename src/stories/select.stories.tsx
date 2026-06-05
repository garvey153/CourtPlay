import type { Meta, StoryObj } from "@storybook/react-vite";
import { User01 } from "@untitledui/icons";
import { Select } from "@/components/base/select/select";

const items = [
    { id: "1", label: "Option One" },
    { id: "2", label: "Option Two" },
    { id: "3", label: "Option Three" },
    { id: "4", label: "Option Four" },
];

const meta = {
    title: "Base/Select",
    component: Select,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md", "lg"] },
    },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        placeholder: "Select an option",
        items,
        children: (item: { id: string; label: string }) => <Select.Item id={item.id}>{item.label}</Select.Item>,
    },
    render: (args) => (
        <div className="w-80">
            <Select {...args} />
        </div>
    ),
};

export const WithLabel: Story = {
    args: {
        label: "Favorite option",
        placeholder: "Select an option",
        items,
        children: (item: { id: string; label: string }) => <Select.Item id={item.id}>{item.label}</Select.Item>,
    },
    render: (args) => (
        <div className="w-80">
            <Select {...args} />
        </div>
    ),
};

export const WithIcon: Story = {
    args: {
        label: "User",
        placeholder: "Select a user",
        icon: User01,
        items,
        children: (item: { id: string; label: string }) => <Select.Item id={item.id}>{item.label}</Select.Item>,
    },
    render: (args) => (
        <div className="w-80">
            <Select {...args} />
        </div>
    ),
};

export const AllSizes: Story = {
    args: {
        placeholder: "Select an option",
        items,
        children: (item: { id: string; label: string }) => <Select.Item id={item.id}>{item.label}</Select.Item>,
    },
    render: (args) => (
        <div className="flex w-80 flex-col gap-4">
            <Select {...args} size="sm" label="Small" />
            <Select {...args} size="md" label="Medium" />
            <Select {...args} size="lg" label="Large" />
        </div>
    ),
};

export const Disabled: Story = {
    args: {
        label: "Disabled select",
        placeholder: "Select an option",
        isDisabled: true,
        items,
        children: (item: { id: string; label: string }) => <Select.Item id={item.id}>{item.label}</Select.Item>,
    },
    render: (args) => (
        <div className="w-80">
            <Select {...args} />
        </div>
    ),
};

export const Required: Story = {
    args: {
        label: "Required select",
        placeholder: "Select an option",
        isRequired: true,
        items,
        children: (item: { id: string; label: string }) => <Select.Item id={item.id}>{item.label}</Select.Item>,
    },
    render: (args) => (
        <div className="w-80">
            <Select {...args} />
        </div>
    ),
};
