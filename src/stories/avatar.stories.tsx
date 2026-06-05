import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "@/components/base/avatar/avatar";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";

const meta = {
    title: "Base/Avatar",
    component: Avatar,
    tags: ["autodocs"],
    argTypes: {
        size: { control: "select", options: ["xs", "sm", "md", "lg", "xl", "2xl"] },
        status: { control: "select", options: [undefined, "online", "offline"] },
    },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        src: "https://i.pravatar.cc/150?img=1",
        alt: "User avatar",
        size: "md",
    },
};

export const WithInitials: Story = {
    args: {
        initials: "OR",
        size: "md",
    },
};

export const WithStatus: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="Online user" size="md" status="online" />
            <Avatar src="https://i.pravatar.cc/150?img=2" alt="Offline user" size="md" status="offline" />
        </div>
    ),
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex items-end gap-4">
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="XS" size="xs" />
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="SM" size="sm" />
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="MD" size="md" />
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="LG" size="lg" />
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="XL" size="xl" />
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="2XL" size="2xl" />
        </div>
    ),
};

export const LabelGroup: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <AvatarLabelGroup src="https://i.pravatar.cc/150?img=1" title="Olivia Rhye" subtitle="olivia@untitledui.com" size="sm" />
            <AvatarLabelGroup src="https://i.pravatar.cc/150?img=2" title="Phoenix Baker" subtitle="phoenix@untitledui.com" size="md" />
            <AvatarLabelGroup src="https://i.pravatar.cc/150?img=3" title="Lana Steiner" subtitle="lana@untitledui.com" size="lg" />
        </div>
    ),
};
