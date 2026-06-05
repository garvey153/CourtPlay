import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PaginationPageDefault } from "@/components/application/pagination/pagination";

const meta = {
    title: "Application/Pagination",
    component: PaginationPageDefault,
    tags: ["autodocs"],
} satisfies Meta<typeof PaginationPageDefault>;

export default meta;
type Story = StoryObj<typeof meta>;

const Template = ({ page: initial = 1, total = 10 }: { page?: number; total?: number }) => {
    const [page, setPage] = useState(initial);
    return <PaginationPageDefault page={page} total={total} onPageChange={setPage} />;
};

export const Default: Story = {
    render: () => <Template page={1} total={10} />,
};

export const MiddlePage: Story = {
    render: () => <Template page={5} total={10} />,
};

export const LastPage: Story = {
    render: () => <Template page={10} total={10} />,
};

export const FewPages: Story = {
    render: () => <Template page={1} total={3} />,
};
