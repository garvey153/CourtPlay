import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";
import { ProgressBarCircle } from "@/components/base/progress-indicators/progress-circles";

const meta = {
    title: "Base/ProgressIndicators",
    tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bar_Default: Story = {
    render: () => (
        <div className="w-96">
            <ProgressBar value={25} labelPosition="right" />
        </div>
    ),
};

export const Bar_Filled: Story = {
    render: () => (
        <div className="w-96">
            <ProgressBar value={75} labelPosition="right" />
        </div>
    ),
};

export const Circle_Default: Story = {
    render: () => <ProgressBarCircle value={40} size="xs" />,
};

export const Circle_Complete: Story = {
    render: () => <ProgressBarCircle value={100} size="xs" />,
};
