import type { Preview } from "@storybook/react-vite";
import "../src/styles/globals.css";

// CourtPlay ships dark-only — index.html adds this unconditionally. Without it
// every story renders against the light palette, which is a theme the app never
// shows anyone.
if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark-mode");
}

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        a11y: {
            test: "todo",
        },
        layout: "centered",
    },
};

export default preview;
