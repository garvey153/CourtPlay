import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { ReportModal } from "@/components/app/report-modal";

const meta = {
    title: "App/ReportModal",
    component: ReportModal,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <Story />
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof ReportModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReportPost: Story = {
    args: {
        targetType: "post",
        targetId: "post-1",
        onClose: () => console.log("onClose"),
    },
};

export const ReportUser: Story = {
    args: {
        targetType: "user",
        targetId: "user-1",
        onClose: () => console.log("onClose"),
    },
};
