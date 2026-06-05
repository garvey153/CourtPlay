import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextArea } from "@/components/base/textarea/textarea";

const meta = {
    title: "Base/TextArea",
    component: TextArea,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md"] },
    },
    decorators: [
        (Story) => (
            <div className="w-96">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        placeholder: "Enter a description...",
        rows: 4,
    },
};

export const WithLabel: Story = {
    args: {
        label: "Description",
        placeholder: "Enter a description...",
        rows: 4,
    },
};

export const WithHint: Story = {
    args: {
        label: "Bio",
        placeholder: "Tell us about yourself...",
        hint: "0/100",
        rows: 4,
    },
};

export const WithMaxLength: Story = {
    args: {
        label: "Short bio",
        placeholder: "Enter up to 150 characters...",
        maxLength: 150,
        rows: 4,
    },
};

export const Disabled: Story = {
    args: {
        label: "Description",
        placeholder: "Disabled textarea",
        isDisabled: true,
        rows: 4,
    },
};

export const WithError: Story = {
    args: {
        label: "Description",
        placeholder: "Enter a description...",
        hint: "This field is required.",
        isInvalid: true,
        rows: 4,
    },
};
