import type { Meta, StoryObj } from "@storybook/react-vite";
import { WelcomeCard } from "@/components/app/welcome-card";

const meta = {
    title: "App/WelcomeCard",
    component: WelcomeCard,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div className="max-w-md p-4 bg-secondary">
                <Story />
            </div>
        ),
    ],
    args: {
        onDismiss: () => console.log("dismiss"),
        onPost: () => console.log("post"),
    },
} satisfies Meta<typeof WelcomeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
