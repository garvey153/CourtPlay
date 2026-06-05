import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { TopNav } from "@/components/layout/top-nav";

const meta = {
    title: "Layout/TopNav",
    component: TopNav,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <div className="bg-secondary">
                    <Story />
                </div>
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof TopNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
