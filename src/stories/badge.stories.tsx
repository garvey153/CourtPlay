import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, BadgeWithDot, BadgeWithIcon } from "@/components/base/badges/badges";

const ArrowUp = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
);

const meta = {
    title: "Base/Badge",
    component: Badge,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md", "lg"] },
        color: {
            control: "select",
            options: ["gray", "brand", "error", "warning", "success", "slate", "sky", "blue", "indigo", "purple", "pink", "orange"],
        },
        type: { control: "select", options: ["pill-color", "color", "modern"] },
    },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: "Label",
        color: "brand",
        size: "md",
        type: "pill-color",
    },
};

export const AllColors: Story = {
    render: () => {
        const colors = ["gray", "brand", "error", "warning", "success", "slate", "sky", "blue", "indigo", "purple", "pink", "orange"] as const;
        return (
            <div className="flex flex-wrap gap-3">
                {colors.map((color) => (
                    <Badge key={color} color={color} size="md" type="pill-color">
                        {color}
                    </Badge>
                ))}
            </div>
        );
    },
};

export const AllTypes: Story = {
    render: () => (
        <div className="flex flex-wrap gap-3">
            <Badge color="brand" size="md" type="pill-color">
                pill-color
            </Badge>
            <Badge color="brand" size="md" type="color">
                color
            </Badge>
            {/* "modern" type only supports gray */}
            <Badge color="gray" size="md" type="modern">
                modern (gray only)
            </Badge>
        </div>
    ),
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex items-center gap-3">
            <Badge color="brand" size="sm" type="pill-color">
                Small
            </Badge>
            <Badge color="brand" size="md" type="pill-color">
                Medium
            </Badge>
            <Badge color="brand" size="lg" type="pill-color">
                Large
            </Badge>
        </div>
    ),
};

export const WithDot: Story = {
    render: () => (
        <div className="flex items-center gap-3">
            <BadgeWithDot color="success" size="md" type="pill-color">
                Active
            </BadgeWithDot>
            <BadgeWithDot color="error" size="md" type="pill-color">
                Inactive
            </BadgeWithDot>
            <BadgeWithDot color="warning" size="md" type="pill-color">
                Pending
            </BadgeWithDot>
        </div>
    ),
};

export const WithIcon: Story = {
    render: () => (
        <div className="flex items-center gap-3">
            <BadgeWithIcon iconLeading={ArrowUp} color="success" size="md" type="pill-color">
                12%
            </BadgeWithIcon>
            <BadgeWithIcon iconLeading={ArrowUp} color="error" size="md" type="pill-color">
                8%
            </BadgeWithIcon>
        </div>
    ),
};
