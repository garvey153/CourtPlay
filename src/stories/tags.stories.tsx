import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";

const meta = {
    title: "Base/Tags",
    component: TagGroup,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["sm", "md", "lg"] },
    },
} satisfies Meta<typeof TagGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <TagGroup label="Tags">
            <TagList className="flex flex-wrap gap-2">
                <Tag id="one">Design</Tag>
                <Tag id="two">Development</Tag>
                <Tag id="three">Marketing</Tag>
            </TagList>
        </TagGroup>
    ),
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <TagGroup label="Small tags" size="sm">
                <TagList className="flex flex-wrap gap-2">
                    <Tag id="sm-1">Small</Tag>
                    <Tag id="sm-2">Tag</Tag>
                </TagList>
            </TagGroup>
            <TagGroup label="Medium tags" size="md">
                <TagList className="flex flex-wrap gap-2">
                    <Tag id="md-1">Medium</Tag>
                    <Tag id="md-2">Tag</Tag>
                </TagList>
            </TagGroup>
            <TagGroup label="Large tags" size="lg">
                <TagList className="flex flex-wrap gap-2">
                    <Tag id="lg-1">Large</Tag>
                    <Tag id="lg-2">Tag</Tag>
                </TagList>
            </TagGroup>
        </div>
    ),
};

export const WithCloseButton: Story = {
    render: () => (
        <TagGroup label="Removable tags">
            <TagList className="flex flex-wrap gap-2">
                <Tag id="one" onClose={() => {}}>
                    React
                </Tag>
                <Tag id="two" onClose={() => {}}>
                    TypeScript
                </Tag>
                <Tag id="three" onClose={() => {}}>
                    Tailwind
                </Tag>
            </TagList>
        </TagGroup>
    ),
};

export const AllColors: Story = {
    render: () => (
        <TagGroup label="Tags with dot colors">
            <TagList className="flex flex-wrap gap-2">
                <Tag id="success" dot dotClassName="text-fg-success-secondary">
                    Active
                </Tag>
                <Tag id="warning" dot dotClassName="text-fg-warning-secondary">
                    Pending
                </Tag>
                <Tag id="error" dot dotClassName="text-fg-error-secondary">
                    Failed
                </Tag>
                <Tag id="brand" dot dotClassName="text-fg-brand-secondary">
                    New
                </Tag>
                <Tag id="gray" dot dotClassName="text-fg-quaternary">
                    Draft
                </Tag>
            </TagList>
        </TagGroup>
    ),
};
