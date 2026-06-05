import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart01, Home01, Settings01 } from "@untitledui/icons";
import { Tabs } from "@/components/application/tabs/tabs";

const meta = {
    title: "Application/Tabs",
    component: Tabs,
    tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Tabs>
            <Tabs.List type="button-brand">
                <Tabs.Item id="overview">Overview</Tabs.Item>
                <Tabs.Item id="analytics">Analytics</Tabs.Item>
                <Tabs.Item id="reports">Reports</Tabs.Item>
            </Tabs.List>
            <Tabs.Panel id="overview" className="pt-4 text-sm text-tertiary">
                Overview content
            </Tabs.Panel>
            <Tabs.Panel id="analytics" className="pt-4 text-sm text-tertiary">
                Analytics content
            </Tabs.Panel>
            <Tabs.Panel id="reports" className="pt-4 text-sm text-tertiary">
                Reports content
            </Tabs.Panel>
        </Tabs>
    ),
};

export const WithIcons: Story = {
    render: () => (
        <Tabs>
            <Tabs.List type="button-brand">
                <Tabs.Item id="home" icon={Home01}>
                    Home
                </Tabs.Item>
                <Tabs.Item id="analytics" icon={BarChart01}>
                    Analytics
                </Tabs.Item>
                <Tabs.Item id="settings" icon={Settings01}>
                    Settings
                </Tabs.Item>
            </Tabs.List>
            <Tabs.Panel id="home" className="pt-4 text-sm text-tertiary">
                Home content
            </Tabs.Panel>
            <Tabs.Panel id="analytics" className="pt-4 text-sm text-tertiary">
                Analytics content
            </Tabs.Panel>
            <Tabs.Panel id="settings" className="pt-4 text-sm text-tertiary">
                Settings content
            </Tabs.Panel>
        </Tabs>
    ),
};

export const VerticalTabs: Story = {
    render: () => (
        <Tabs orientation="vertical" className="flex flex-row gap-6">
            <Tabs.List type="line" orientation="vertical">
                <Tabs.Item id="account">Account</Tabs.Item>
                <Tabs.Item id="notifications">Notifications</Tabs.Item>
                <Tabs.Item id="billing">Billing</Tabs.Item>
            </Tabs.List>
            <Tabs.Panel id="account" className="text-sm text-tertiary">
                Account content
            </Tabs.Panel>
            <Tabs.Panel id="notifications" className="text-sm text-tertiary">
                Notifications content
            </Tabs.Panel>
            <Tabs.Panel id="billing" className="text-sm text-tertiary">
                Billing content
            </Tabs.Panel>
        </Tabs>
    ),
};
