import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";

const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const meta = {
    title: "Foundations/FeaturedIcon",
    component: FeaturedIcon,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md", "lg", "xl"] },
        color: { control: "select", options: ["brand", "gray", "error", "warning", "success"] },
        theme: { control: "select", options: ["light", "gradient", "dark", "modern", "modern-neue", "outline"] },
    },
} satisfies Meta<typeof FeaturedIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        icon: CheckIcon,
        theme: "light",
        color: "brand",
        size: "lg",
    },
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <FeaturedIcon icon={CheckIcon} size="sm" color="brand" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="md" color="brand" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="brand" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="xl" color="brand" theme="light" />
        </div>
    ),
};

export const AllColors: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <FeaturedIcon icon={CheckIcon} size="lg" color="brand" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="gray" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="error" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="warning" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="success" theme="light" />
        </div>
    ),
};

export const AllThemes: Story = {
    render: () => (
        <div className="flex flex-wrap items-center gap-6">
            <FeaturedIcon icon={CheckIcon} size="lg" color="brand" theme="light" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="brand" theme="gradient" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="brand" theme="dark" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="brand" theme="outline" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="gray" theme="modern" />
            <FeaturedIcon icon={CheckIcon} size="lg" color="gray" theme="modern-neue" />
        </div>
    ),
};

export const Large: Story = {
    args: {
        icon: CheckIcon,
        theme: "light",
        color: "brand",
        size: "xl",
    },
};
