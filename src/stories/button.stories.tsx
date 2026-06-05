import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/base/buttons/button";

const ArrowRight = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
);

const ArrowLeft = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
);

const meta = {
    title: "Base/Button",
    component: Button,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["xs", "sm", "md", "lg", "xl"] },
        color: {
            control: "select",
            options: [
                "primary",
                "secondary",
                "tertiary",
                "primary-destructive",
                "secondary-destructive",
                "tertiary-destructive",
                "link-gray",
                "link-color",
                "link-destructive",
            ],
        },
    },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
    args: {
        children: "Button",
        color: "primary",
        size: "sm",
    },
};

export const Secondary: Story = {
    args: {
        children: "Button",
        color: "secondary",
    },
};

export const Tertiary: Story = {
    args: {
        children: "Button",
        color: "tertiary",
    },
};

export const Destructive: Story = {
    args: {
        children: "Delete",
        color: "primary-destructive",
    },
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra Large</Button>
        </div>
    ),
};

export const AllColors: Story = {
    render: () => (
        <div className="flex flex-wrap gap-4">
            <Button color="primary">Primary</Button>
            <Button color="secondary">Secondary</Button>
            <Button color="tertiary">Tertiary</Button>
            <Button color="link-gray">Link Gray</Button>
            <Button color="link-color">Link Color</Button>
            <Button color="primary-destructive">Destructive</Button>
            <Button color="secondary-destructive">Secondary Destructive</Button>
            <Button color="tertiary-destructive">Tertiary Destructive</Button>
            <Button color="link-destructive">Link Destructive</Button>
        </div>
    ),
};

export const Loading: Story = {
    args: {
        children: "Submit",
        isLoading: true,
    },
};

export const LoadingWithText: Story = {
    args: {
        children: "Submitting...",
        isLoading: true,
        showTextWhileLoading: true,
    },
};

export const Disabled: Story = {
    args: {
        children: "Disabled",
        isDisabled: true,
    },
};

export const WithIcons: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <Button iconLeading={ArrowLeft}>Back</Button>
            <Button iconTrailing={ArrowRight}>Next</Button>
            <Button iconLeading={ArrowLeft} iconTrailing={ArrowRight}>
                Both Icons
            </Button>
        </div>
    ),
};
