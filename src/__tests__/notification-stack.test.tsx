import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationStack, type FeedNotification } from "@/components/app/notification-stack";

const banner = (name: string, onDismiss = vi.fn()) => (
    <div className="relative rounded-lg bg-brand-800 p-4">
        <p>{name}</p>
        <button type="button" onClick={onDismiss}>
            Dismiss {name}
        </button>
    </div>
);

const items = (...names: string[]): FeedNotification[] => names.map((n) => ({ key: n, node: banner(n) }));

/**
 * One notification shows; the rest wait behind it. The two things worth pinning
 * are that the FIRST item is the one on top — the caller's order is the
 * priority — and that tapping a control inside the card does not count as
 * tapping the card, since every banner carries Dismiss and View.
 */
describe("NotificationStack", () => {
    const peeks = (c: HTMLElement) => c.querySelectorAll('[aria-hidden="true"].bg-brand-800');

    it("renders nothing when there is nothing to say", () => {
        const { container } = render(<NotificationStack items={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("one notification shows on its own, with no stack behind it", () => {
        const { container } = render(<NotificationStack items={items("Claim approved")} />);
        expect(screen.getByText("Claim approved")).toBeInTheDocument();
        expect(peeks(container)).toHaveLength(0);
    });

    it("with several, only the highest-priority one shows", () => {
        render(<NotificationStack items={items("First", "Second", "Third")} />);
        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.queryByText("Second")).not.toBeInTheDocument();
        expect(screen.queryByText("Third")).not.toBeInTheDocument();
    });

    it("two waiting draw two edges; four draw two as well", () => {
        const { container, rerender } = render(<NotificationStack items={items("a", "b")} />);
        expect(peeks(container)).toHaveLength(1);

        rerender(<NotificationStack items={items("a", "b", "c")} />);
        expect(peeks(container)).toHaveLength(2);

        // Capped: a third edge adds 8px and no information.
        rerender(<NotificationStack items={items("a", "b", "c", "d", "e")} />);
        expect(peeks(container)).toHaveLength(2);
    });

    it("stacks to the design's geometry: 2px/8px steps, 8px of room below", async () => {
        const { container } = render(<NotificationStack items={items("a", "b", "c")} />);
        const wrap = container.firstElementChild as HTMLElement;
        // design-system 650:1963 — a 360x152 frame around a 360x128 card, so the
        // stack is the card plus 24, not plus 16.
        expect(wrap.className).toContain("pb-6");

        const [mid, back] = [...wrap.querySelectorAll('[aria-hidden="true"]')] as HTMLElement[];
        expect(mid.className).toContain("inset-x-0.5");
        expect(mid.className).toContain("top-2");
        expect(mid.className).toContain("bottom-4");
        expect(back.className).toContain("inset-x-1");
        expect(back.className).toContain("top-4");
        expect(back.className).toContain("bottom-2");
    });

    it("stays collapsed after a re-render — expanding is a tap, not a state to keep", () => {
        const { rerender, container } = render(<NotificationStack items={items("a", "b", "c")} />);
        rerender(<NotificationStack items={items("a", "b", "c")} />);
        expect(peeks(container)).toHaveLength(2);
        expect(screen.queryByText("b")).not.toBeInTheDocument();
    });

    it("tapping the card opens the stack", async () => {
        const user = userEvent.setup();
        const { container } = render(<NotificationStack items={items("First", "Second", "Third")} />);
        await user.click(screen.getByText("First"));

        expect(screen.getByText("Second")).toBeInTheDocument();
        expect(screen.getByText("Third")).toBeInTheDocument();
        expect(peeks(container)).toHaveLength(0);
    });

    it("tapping a control inside the card does NOT open the stack", async () => {
        const onDismiss = vi.fn();
        const user = userEvent.setup();
        render(
            <NotificationStack
                items={[
                    { key: "a", node: banner("First", onDismiss) },
                    ...items("Second"),
                ]}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Dismiss First" }));
        expect(onDismiss).toHaveBeenCalled();
        expect(screen.queryByText("Second")).not.toBeInTheDocument();
    });

    it("offers the same thing to a screen reader", async () => {
        const user = userEvent.setup();
        render(<NotificationStack items={items("First", "Second")} />);
        await user.click(screen.getByRole("button", { name: "Show all 2 notifications" }));
        expect(screen.getByText("Second")).toBeInTheDocument();
    });
});
