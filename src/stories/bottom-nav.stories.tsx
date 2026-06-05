import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { BottomNav } from "@/components/layout/bottom-nav";

const meta = {
    title: "Layout/BottomNav",
    component: BottomNav,
    tags: ["autodocs"],
    decorators: [
        (Story, ctx) => (
            <MemoryRouter initialEntries={[ctx.parameters.path ?? "/feed"]}>
                <div className="relative h-32 bg-secondary">
                    <Story />
                </div>
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof BottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FeedActive: Story = {
    parameters: { path: "/feed" },
};

export const ActivityActive: Story = {
    parameters: { path: "/activity" },
};

export const ProfileActive: Story = {
    parameters: { path: "/profile/me" },
};
