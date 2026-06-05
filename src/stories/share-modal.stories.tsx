import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { ShareModal } from "@/components/app/share-modal";

const meta = {
    title: "App/ShareModal",
    component: ShareModal,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <Story />
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof ShareModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        url: "https://courtplay.app/post/abc",
        text: "Check out this tennis game",
        onClose: () => console.log("onClose"),
    },
};

export const LongText: Story = {
    args: {
        url: "https://courtplay.app/post/abc",
        text: "Open spot at Longshore Club tomorrow at 9am — point play, 4.0 NTRP, $25",
        onClose: () => console.log("onClose"),
    },
};
