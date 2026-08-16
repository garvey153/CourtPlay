import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { InviteOnly } from "@/pages/invite-only";

/**
 * Where an uninvited Google sign-in lands (Figma 662:4309). Worth a story
 * because reaching the real screen needs a Google account that is not on the
 * invite list.
 */
const meta = {
    title: "App/InviteOnly",
    component: InviteOnly,
    parameters: { layout: "fullscreen" },
    decorators: [
        (Story) => (
            <MemoryRouter initialEntries={[{ pathname: "/invite-only", state: { email: "cgarvey21@gmail.com" } }]}>
                <Story />
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof InviteOnly>;

export default meta;
export const Default: StoryObj<typeof meta> = {};
