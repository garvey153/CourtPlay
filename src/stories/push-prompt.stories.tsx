import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { PushPrompt } from "@/components/app/push-prompt";

const meta = {
    title: "App/PushPrompt",
    component: PushPrompt,
    tags: ["autodocs"],
    decorators: [
        (Story) => {
            if (typeof window !== "undefined") {
                localStorage.removeItem("courtsub_push_prompt_dismissed");
            }
            return (
                <MemoryRouter>
                    <div className="max-w-md p-4 bg-secondary">
                        <Story />
                    </div>
                </MemoryRouter>
            );
        },
    ],
} satisfies Meta<typeof PushPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PostCreated: Story = {
    args: {
        variant: "post_created",
    },
};

export const PostViewed: Story = {
    args: {
        variant: "post_viewed",
    },
};
