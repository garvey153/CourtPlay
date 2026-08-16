import type { Meta, StoryObj } from "@storybook/react-vite";
import { InstallGuide } from "@/components/app/install-guide";

/**
 * The "Add to Home Screen" bottom sheet (Figma 659:2070).
 *
 * Worth a story because the real thing is hard to reach: it only appears behind
 * the iOS install prompt in the feed's notification stack, which needs an
 * authenticated session on an iOS device that has not already installed the app.
 */
const meta = {
    title: "App/InstallGuide",
    component: InstallGuide,
    parameters: { layout: "fullscreen" },
    args: { onClose: () => {} },
} satisfies Meta<typeof InstallGuide>;

export default meta;
type Story = StoryObj<typeof meta>;

/** iOS: the four-step Safari flow the design specifies. */
export const IOS: Story = {
    decorators: [
        (Story) => {
            // The component reads isIos() at render; Storybook runs in a desktop
            // browser, so pretend.
            Object.defineProperty(window.navigator, "userAgent", {
                value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                configurable: true,
            });
            return <Story />;
        },
    ],
};

/** Everything else: the same sheet, with the generic browser steps. */
export const OtherBrowsers: Story = {};
