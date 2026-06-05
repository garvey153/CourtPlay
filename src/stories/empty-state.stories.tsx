import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, SearchLg, UsersPlus } from "@untitledui/icons";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { Button } from "@/components/base/buttons/button";

const meta = {
    title: "Application/EmptyState",
    component: EmptyState,
    tags: ["autodocs"],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <EmptyState>
            <EmptyState.Header />
            <EmptyState.Content>
                <EmptyState.Title>No items found</EmptyState.Title>
                <EmptyState.Description>You haven't added anything here yet.</EmptyState.Description>
            </EmptyState.Content>
        </EmptyState>
    ),
};

export const WithIcon: Story = {
    render: () => (
        <EmptyState>
            <EmptyState.Header>
                <EmptyState.FeaturedIcon icon={UsersPlus} />
            </EmptyState.Header>
            <EmptyState.Content>
                <EmptyState.Title>No team members</EmptyState.Title>
                <EmptyState.Description>Invite someone to get started.</EmptyState.Description>
            </EmptyState.Content>
        </EmptyState>
    ),
};

export const WithCTA: Story = {
    render: () => (
        <EmptyState>
            <EmptyState.Header>
                <EmptyState.FeaturedIcon icon={UsersPlus} />
            </EmptyState.Header>
            <EmptyState.Content>
                <EmptyState.Title>No projects yet</EmptyState.Title>
                <EmptyState.Description>Get started by creating your first project.</EmptyState.Description>
            </EmptyState.Content>
            <EmptyState.Footer>
                <Button color="secondary">Learn more</Button>
                <Button color="primary" iconLeading={Plus}>
                    New project
                </Button>
            </EmptyState.Footer>
        </EmptyState>
    ),
};

export const NoResults: Story = {
    render: () => (
        <EmptyState>
            <EmptyState.Header>
                <EmptyState.FeaturedIcon icon={SearchLg} />
            </EmptyState.Header>
            <EmptyState.Content>
                <EmptyState.Title>No results found</EmptyState.Title>
                <EmptyState.Description>
                    Your search didn't match any results. Please try again.
                </EmptyState.Description>
            </EmptyState.Content>
            <EmptyState.Footer>
                <Button color="secondary">Clear search</Button>
            </EmptyState.Footer>
        </EmptyState>
    ),
};
