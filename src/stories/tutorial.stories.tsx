import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { TutorialCarousel } from "@/components/app/tutorial-carousel";
import { TUTORIAL_SLIDES } from "@/lib/tutorial-slides";

/**
 * The post-onboarding tutorial. Worth a story because the real thing shows
 * once, immediately after signing up with a fresh invited account.
 */
const meta = {
    title: "App/TutorialCarousel",
    component: TutorialCarousel,
    parameters: { layout: "fullscreen" },
    args: { slides: TUTORIAL_SLIDES, onSkip: () => {}, onDone: () => {} },
    decorators: [
        (Story) => (
            <MemoryRouter>
                <Story />
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof TutorialCarousel>;

export default meta;
export const Default: StoryObj<typeof meta> = {};
