import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { ClaimModal } from "@/components/app/claim-modal";
import type { FeedPost } from "@/types/feed";

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
    return {
        id: "post-1",
        author_id: "author-1",
        author_type: "player" as const,
        post_type: "sub_need" as const,
        format: "point_play",
        total_players: 4,
        game_date: "2026-04-15",
        game_time: "09:00",
        skill_level: "4.0",
        location: "Longshore Club",
        court_id: "1",
        custom_court: null,
        pro_name: null,
        cost: 25,
        original_cost: null,
        spots_total: 1,
        series_id: null,
        notes: null,
        status: "active",
        view_count: 5,
        expires_at: null,
        preferred_days: null,
        preferred_times: null,
        created_at: new Date().toISOString(),
        first_name: "Olivia",
        last_name: "Rhye",
        photo_url: null,
        is_friend: false,
        spots_available: 1,
        user_claim_status: null,
        user_claim_id: null,
        user_notify_me: false,
        ...overrides,
    } as FeedPost;
}

const meta = {
    title: "App/ClaimModal",
    component: ClaimModal,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <MemoryRouter>
                <Story />
            </MemoryRouter>
        ),
    ],
} satisfies Meta<typeof ClaimModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        post: makePost(),
        onClose: () => console.log("onClose"),
        onSuccess: (claimId: string) => console.log("onSuccess", claimId),
    },
};

export const FreeGame: Story = {
    args: {
        post: makePost({ cost: null }),
        onClose: () => console.log("onClose"),
        onSuccess: (claimId: string) => console.log("onSuccess", claimId),
    },
};

export const WithLocation: Story = {
    args: {
        post: makePost({ location: "Longshore Club" }),
        onClose: () => console.log("onClose"),
        onSuccess: (claimId: string) => console.log("onSuccess", claimId),
    },
};
