import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FeedFilters } from "@/components/app/feed-filters";

interface FilterState {
    skillLevels: string[];
    formats: string[];
    dateFrom: string | null;
    dateTo: string | null;
    courtIds: string[];
}

const mockCourts = [
    { id: "1", name: "Longshore Club" },
    { id: "2", name: "Staples HS" },
    { id: "3", name: "Weston Field Club" },
];

const emptyFilters: FilterState = {
    skillLevels: [],
    formats: [],
    dateFrom: null,
    dateTo: null,
    courtIds: [],
};

type WrapperArgs = {
    filters: FilterState;
    isOpen: boolean;
    courts: { id: string; name: string }[];
};

function FeedFiltersWrapper(args: WrapperArgs) {
    const [filters, setFilters] = useState<FilterState>(args.filters);
    const [isOpen, setIsOpen] = useState(args.isOpen);
    return (
        <FeedFilters
            filters={filters}
            onChange={setFilters}
            courts={args.courts}
            isOpen={isOpen}
            onToggle={() => setIsOpen(!isOpen)}
        />
    );
}

const meta = {
    title: "App/FeedFilters",
    component: FeedFiltersWrapper,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div className="max-w-md p-4 bg-secondary">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof FeedFiltersWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
    args: {
        filters: emptyFilters,
        isOpen: false,
        courts: mockCourts,
    },
};

export const OpenEmpty: Story = {
    args: {
        filters: emptyFilters,
        isOpen: true,
        courts: mockCourts,
    },
};

export const OpenWithFilters: Story = {
    args: {
        filters: {
            skillLevels: ["4.0"],
            formats: ["point_play"],
            dateFrom: null,
            dateTo: null,
            courtIds: ["1"],
        },
        isOpen: true,
        courts: mockCourts,
    },
};

export const OpenWithCourts: Story = {
    args: {
        filters: emptyFilters,
        isOpen: true,
        courts: [
            ...mockCourts,
            { id: "4", name: "Fairfield Racquet Club" },
            { id: "5", name: "Wee Burn Country Club" },
            { id: "6", name: "Greenwich Indoor Tennis" },
        ],
    },
};
