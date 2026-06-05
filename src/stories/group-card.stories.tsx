import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { GroupCard } from "@/components/app/group-card";
import type { FeedPost } from "@/types/feed";

if (typeof window !== "undefined" && !window.IntersectionObserver) {
    // @ts-expect-error - jsdom stub
    window.IntersectionObserver = class {
        observe = () => {};
        disconnect = () => {};
        unobserve = () => {};
    };
}

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1",
        author_id: "author-1",
        author_type: "player",
        post_type: "regular_game",
        format: "doubles",
        total_players: 4,
        game_date: null,
        game_time: null,
        skill_level: "3.5",
        location: "Longshore Club",
        court_id: "court-1",
        custom_court: null,
        pro_name: null,
        cost: null,
        original_cost: null,
        spots_total: 1,
        series_id: null,
        notes: "We play weekly and are looking for a regular fourth.",
        status: "active",
        view_count: 12,
        expires_at: null,
        preferred_days: ["monday", "wednesday", "friday"],
        preferred_times: ["morning", "evening"],
        created_at: new Date().toISOString(),
        first_name: "Phoenix",
        last_name: "Baker",
        photo_url: null,
        is_friend: false,
        spots_available: 1,
        user_claim_status: "unclaimed",
        user_claim_id: null,
        user_notify_me: false,
        ...overrides,
    };
}

const meta = {
    title: "App/GroupCard",
    component: GroupCard,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <div className="max-w-md p-4 bg-secondary">
                    <Story />
                </div>
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof GroupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        post: makePost(),
        profileComplete: true,
        currentUserId: "viewer-1",
    },
};

export const ProfileIncomplete: Story = {
    args: {
        post: makePost(),
        profileComplete: false,
        currentUserId: "viewer-1",
    },
};

export const OwnPost: Story = {
    args: {
        post: makePost({ author_id: "viewer-1" }),
        profileComplete: true,
        currentUserId: "viewer-1",
    },
};

export const FromFriend: Story = {
    args: {
        post: makePost({ is_friend: true }),
        profileComplete: true,
        currentUserId: "viewer-1",
    },
};
