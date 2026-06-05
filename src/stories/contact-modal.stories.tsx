import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { ContactModal } from "@/components/app/contact-modal";

const baseInfo = {
    role: "poster" as const,
    firstName: "Olivia",
    lastName: "Rhye",
    phone: "203-555-0101",
    venmoHandle: "oliviarhye",
    gameDate: "2026-04-15",
    gameTime: "09:00",
    location: "Longshore Club",
    cost: 25,
    viewerRole: "claimer" as const,
};

const meta = {
    title: "App/ContactModal",
    component: ContactModal,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <Story />
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof ContactModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AsClaimerViewingPoster: Story = {
    args: {
        info: { ...baseInfo, role: "poster", viewerRole: "claimer" },
        onClose: () => console.log("onClose"),
    },
};

export const AsPosterViewingClaimer: Story = {
    args: {
        info: { ...baseInfo, role: "claimer", viewerRole: "poster" },
        onClose: () => console.log("onClose"),
    },
};

export const NoVenmo: Story = {
    args: {
        info: { ...baseInfo, venmoHandle: null },
        onClose: () => console.log("onClose"),
    },
};

export const NoPhone: Story = {
    args: {
        info: { ...baseInfo, phone: null },
        onClose: () => console.log("onClose"),
    },
};

export const FreeGame: Story = {
    args: {
        info: { ...baseInfo, cost: null },
        onClose: () => console.log("onClose"),
    },
};
