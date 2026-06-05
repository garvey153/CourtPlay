import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatePicker } from "@/components/application/date-picker/date-picker";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";

const meta = {
    title: "Application/DatePicker",
    component: DatePicker,
    tags: ["autodocs"],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => <DatePicker />,
};

export const WithLabel: Story = {
    render: () => (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-secondary">Select a date</label>
            <DatePicker />
        </div>
    ),
};

export const DateRange: Story = {
    render: () => <DateRangePicker />,
};

export const Disabled: Story = {
    render: () => <DatePicker isDisabled />,
};
