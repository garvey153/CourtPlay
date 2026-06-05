import type { Meta, StoryObj } from "@storybook/react-vite";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";

const ListIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const GridIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
    </svg>
);

const ColumnsIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
);

const meta = {
    title: "Base/ButtonGroup",
    component: ButtonGroup,
    tags: ["autodocs"],
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <ButtonGroup defaultSelectedKeys={["one"]}>
            <ButtonGroupItem id="one">One</ButtonGroupItem>
            <ButtonGroupItem id="two">Two</ButtonGroupItem>
            <ButtonGroupItem id="three">Three</ButtonGroupItem>
        </ButtonGroup>
    ),
};

export const TwoButtons: Story = {
    render: () => (
        <ButtonGroup defaultSelectedKeys={["left"]}>
            <ButtonGroupItem id="left">Left</ButtonGroupItem>
            <ButtonGroupItem id="right">Right</ButtonGroupItem>
        </ButtonGroup>
    ),
};

export const WithIcons: Story = {
    render: () => (
        <ButtonGroup defaultSelectedKeys={["list"]}>
            <ButtonGroupItem id="list" iconLeading={ListIcon}>
                List
            </ButtonGroupItem>
            <ButtonGroupItem id="grid" iconLeading={GridIcon}>
                Grid
            </ButtonGroupItem>
            <ButtonGroupItem id="columns" iconLeading={ColumnsIcon}>
                Columns
            </ButtonGroupItem>
        </ButtonGroup>
    ),
};
