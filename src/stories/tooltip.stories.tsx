import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/base/buttons/button";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";

const meta = {
    title: "Base/Tooltip",
    component: Tooltip,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div className="flex min-h-32 items-center justify-center p-8">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        title: "Tooltip content",
        children: <TooltipTrigger>Hover me</TooltipTrigger>,
    },
};

export const WithLongText: Story = {
    args: {
        title: "More information",
        description: "This tooltip contains a longer description that explains the action in more detail for the user.",
        children: <TooltipTrigger>Hover for details</TooltipTrigger>,
    },
};

export const OnButton: Story = {
    args: {
        title: "Save changes",
        arrow: true,
        children: (
            <TooltipTrigger>
                <Button>Save</Button>
            </TooltipTrigger>
        ),
    },
};
