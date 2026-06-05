import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { IosInstallPrompt } from "@/components/app/ios-install-prompt";

const meta = {
    title: "App/IosInstallPrompt",
    component: IosInstallPrompt,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <Story />
            </MemoryRouter>
        ),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    "This prompt only renders on iOS Safari, for logged-in users not in standalone mode. In Storybook on a desktop browser, it will not display.",
            },
        },
    },
} satisfies Meta<typeof IosInstallPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
