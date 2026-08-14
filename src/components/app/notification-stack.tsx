import { Fragment, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface FeedNotification {
    /** Stable across renders — the same key the banner's dismissal is recorded under. */
    key: string;
    node: ReactNode;
}

/**
 * The cards behind, from design-system 650:1963. Its frame is 360×152 around a
 * 360×128 card, so the stack is the card plus 24 — each card behind is inset 2px
 * per side and dropped 8px, and 8px of room is left under the last one.
 *
 * `bottom` is measured from the container, which is 24px taller than the card:
 * bottom-4 puts the middle card's edge 8px below the front card, bottom-2 puts
 * the back card's 16px below.
 */
const STACK_PAD = "pb-6";
const PEEK = [
    { inset: "inset-x-0.5", top: "top-2", bottom: "bottom-4" },
    { inset: "inset-x-1", top: "top-4", bottom: "bottom-2" },
] as const;

/**
 * The feed shows ONE notification, with the rest stacked behind it.
 *
 * Before this, every banner rendered at once and could push the feed itself off
 * the screen — a player with three group changes and a claim saw four cards
 * before a single post. Now the highest-priority one is on top, the others are
 * two peeking edges, and tapping the card opens the full list.
 *
 * The order of `items` IS the priority. It is decided by the caller, which is
 * where the conditions that produce each banner already live.
 *
 * The cards behind are plain blocks rather than the real banners. Every banner
 * is `rounded-lg bg-brand-800`, so an 8px edge of one is indistinguishable from
 * an 8px edge of another — and rendering the real ones would put their buttons
 * and close controls in the tree twice, where a screen reader would read them.
 */
export function NotificationStack({ items }: { items: FeedNotification[] }) {
    const [expanded, setExpanded] = useState(false);

    if (items.length === 0) return null;

    const stacked = items.length > 1 && !expanded;
    // One edge per waiting notification, and PEEK itself is the cap at two: a
    // third adds 8px and no information, and the design draws two.
    const peeks = stacked ? PEEK.slice(0, items.length - 1) : [];

    return (
        <div className={stacked ? `relative ${STACK_PAD}` : "flex flex-col gap-3"}>
            {peeks.map((p, i) => (
                <div
                    key={i}
                    aria-hidden="true"
                    className={`absolute ${p.inset} ${p.top} ${p.bottom} rounded-lg bg-brand-800 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]`}
                />
            ))}

            {stacked ? (
                /* Tapping the card opens the stack — but not when the tap was on
                   one of its own controls, which have their own jobs. A wrapper
                   with a click handler rather than a <button>, because the card
                   already contains buttons and nesting them is invalid. */
                <div
                    className="relative"
                    onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, a")) return;
                        setExpanded(true);
                    }}
                >
                    {/* The shadow is what separates the card from the edges behind
                        it — same colour, so without it the stack reads as one card
                        with odd corners. rounded-lg matches the banner it wraps. */}
                    <div className="cursor-pointer rounded-lg shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">{items[0].node}</div>
                    <p className="sr-only">
                        <button type="button" onClick={() => setExpanded(true)}>
                            Show all {items.length} notifications
                        </button>
                    </p>
                </div>
            ) : (
                <AnimatePresence initial={false}>
                    {items.map((item, i) => (
                        <motion.div
                            key={item.key}
                            initial={items.length > 1 && i > 0 ? { opacity: 0, y: -8 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut", delay: i * 0.03 }}
                        >
                            <Fragment>{item.node}</Fragment>
                        </motion.div>
                    ))}
                </AnimatePresence>
            )}
        </div>
    );
}
