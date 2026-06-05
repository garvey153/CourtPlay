import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";

const meta = {
    title: "Base/RadioButtons",
    component: RadioGroup,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md"] },
    },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: (args) => (
        <RadioGroup {...args}>
            <RadioButton value="one" label="Option one" />
            <RadioButton value="two" label="Option two" />
            <RadioButton value="three" label="Option three" />
        </RadioGroup>
    ),
};

export const WithLabel: Story = {
    render: (args) => (
        <RadioGroup {...args} aria-label="Preferred contact method">
            <RadioButton value="email" label="Email" hint="We'll send updates to your inbox." />
            <RadioButton value="sms" label="SMS" hint="Text messages to your phone." />
            <RadioButton value="push" label="Push notification" hint="In-app push notifications." />
        </RadioGroup>
    ),
};

export const Disabled: Story = {
    render: (args) => (
        <RadioGroup {...args} isDisabled>
            <RadioButton value="one" label="Option one" />
            <RadioButton value="two" label="Option two" />
            <RadioButton value="three" label="Option three" />
        </RadioGroup>
    ),
};

export const Selected: Story = {
    render: (args) => (
        <RadioGroup {...args} defaultValue="two">
            <RadioButton value="one" label="Option one" />
            <RadioButton value="two" label="Option two" />
            <RadioButton value="three" label="Option three" />
        </RadioGroup>
    ),
};
