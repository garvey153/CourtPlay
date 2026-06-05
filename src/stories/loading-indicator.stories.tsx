import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";

const meta = {
    title: "Application/LoadingIndicator",
    component: LoadingIndicator,
    tags: ["autodocs"],
    argTypes: {
        type: { control: "select", options: ["line-simple", "line-spinner", "dot-circle"] },
        size: { control: "select", options: ["sm", "md", "lg", "xl"] },
    },
} satisfies Meta<typeof LoadingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        type: "line-simple",
        size: "md",
    },
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex items-end gap-8">
            <LoadingIndicator size="sm" label="Small" />
            <LoadingIndicator size="md" label="Medium" />
            <LoadingIndicator size="lg" label="Large" />
            <LoadingIndicator size="xl" label="Extra Large" />
        </div>
    ),
};

export const WithText: Story = {
    args: {
        type: "line-spinner",
        size: "lg",
        label: "Loading...",
    },
};
