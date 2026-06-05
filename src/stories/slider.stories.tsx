import type { Meta, StoryObj } from "@storybook/react-vite";
import { Slider } from "@/components/base/slider/slider";

const meta = {
    title: "Base/Slider",
    component: Slider,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div className="w-96 p-4">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        defaultValue: 40,
    },
};

export const WithLabel: Story = {
    args: {
        defaultValue: 60,
        labelPosition: "bottom",
    },
};

export const Range: Story = {
    args: {
        defaultValue: [20, 80],
    },
};

export const Disabled: Story = {
    args: {
        defaultValue: 50,
        isDisabled: true,
    },
};
