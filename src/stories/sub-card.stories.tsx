import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { SubCard } from "@/components/app/sub-card";
import type { FeedPost } from "@/types/feed";

if (typeof window !== "undefined" && !window.IntersectionObserver) {
    // @ts-expect-error - jsdom stub
    window.IntersectionObserver = class {
        observe = () => {};
        disconnect = () => {};
        unobserve = () => {};
    };
}

function gameInHours(hours: number) {
    const t = new Date(Date.now() + hours * 3600000);
    return {
        game_date: t.toISOString().slice(0, 10),
        game_time: t.toTimeString().slice(0, 5),
    };
}

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    const inTwoDays = gameInHours(48);
    return {
        id: "post-1",
        author_id: "author-1",
        author_type: "player",
        post_type: "sub_need",
        format: "doubles",
        total_players: 4,
        game_date: inTwoDays.game_date,
        game_time: inTwoDays.game_time,
        skill_level: "3.5",
        location: "Longshore Club",
        court_id: "court-1",
        custom_court: null,
        pro_name: null,
        cost: 25,
        original_cost: null,
        spots_total: 1,
        series_id: null,
        notes: "Looking for one player to join our friendly doubles match.",
        status: "active",
        view_count: 8,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Olivia",
        last_name: "Rhye",
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
    title: "App/SubCard",
    component: SubCard,
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
} satisfies Meta<typeof SubCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        post: makePost(),
        currentUserId: "viewer-1",
    },
};

export const WithDiscount: Story = {
    args: {
        post: makePost({ cost: 25, original_cost: 40 }),
        currentUserId: "viewer-1",
    },
};

export const AllSpotsFilled: Story = {
    args: {
        post: makePost({ spots_available: 0, spots_total: 1 }),
        currentUserId: "viewer-1",
    },
};

export const WithTimePressure_Green: Story = {
    args: {
        post: makePost({ ...gameInHours(14) }),
        currentUserId: "viewer-1",
    },
};

export const WithTimePressure_Amber: Story = {
    args: {
        post: makePost({ ...gameInHours(8) }),
        currentUserId: "viewer-1",
    },
};

export const WithTimePressure_Red: Story = {
    args: {
        post: makePost({ ...gameInHours(3) }),
        currentUserId: "viewer-1",
    },
};

export const OwnPost: Story = {
    args: {
        post: makePost({ author_id: "viewer-1" }),
        currentUserId: "viewer-1",
    },
};

export const PendingClaim: Story = {
    args: {
        post: makePost({ user_claim_status: "pending", user_claim_id: "claim-1" }),
        currentUserId: "viewer-1",
    },
};

export const ApprovedClaim: Story = {
    args: {
        post: makePost({ user_claim_status: "approved", user_claim_id: "claim-1" }),
        currentUserId: "viewer-1",
    },
};

export const FromFriend: Story = {
    args: {
        post: makePost({ is_friend: true }),
        currentUserId: "viewer-1",
    },
};

export const HighViewCount: Story = {
    args: {
        post: makePost({ view_count: 47 }),
        currentUserId: "viewer-1",
    },
};
