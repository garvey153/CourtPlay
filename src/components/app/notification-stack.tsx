import { Fragment, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface FeedNotification {
    /** Stable across renders — the same key the banner's dismissal is recorded under. */
    key: string;
    node: ReactNode;
}

/**
 * The cards behind, from design-system 650:1963: each is inset 2px per side and
 * dropped 8px below the one in front.
 *
 * FURTHEST FIRST. These are absolutely positioned with no z-index, so they paint
 * in DOM order and the last one wins. Listed nearest-first, the back card
 * painted over the middle card's shadow and the middle looked flat.
 *
 * `count` is how many notifications are waiting before this card appears, so a
 * single extra one draws the NEAREST card rather than the far one.
 */
const SHADOW = "shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]";
const PEEK = [
    // 650:1964 — the back card, and the only one in the frame without a shadow:
    // nothing sits below it to catch one.
    { inset: "inset-x-1", top: "top-4", drop: 16, shadow: "", count: 2 },
    // 650:2025 — sits between, and casts onto the card behind it.
    { inset: "inset-x-0.5", top: "top-2", drop: 8, shadow: SHADOW, count: 1 },
] as const;

/**
 * The stack reserves exactly as much room as it uses, so the feed's 12px gap is
 * the whole distance to the first post.
 *
 * Keyed by the DEEPEST card actually drawn, which is why it is not a constant:
 * two notifications drop one card 8px, three or more drop one 16px, and padding
 * for a card that is not there leaves a gap of 20px instead of 12.
 */
const PAD: Record<number, string> = { 8: "pb-2", 16: "pb-4" };
/** A peek's offset from the container's bottom: the padding minus its own drop. */
const BOTTOM: Record<number, string> = { 0: "bottom-0", 8: "bottom-2" };

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
    const cardRef = useRef<HTMLDivElement>(null);

    if (items.length === 0) return null;

    const stacked = items.length > 1 && !expanded;
    // One edge per waiting notification, capped at the two the design draws: a
    // third adds 8px and no information.
    const waiting = items.length - 1;
    const peeks = stacked ? PEEK.filter((p) => p.count <= waiting) : [];
    const depth = peeks.length > 1 ? 16 : 8;

    return (
        <div className={stacked ? `relative ${PAD[depth]}` : "flex flex-col gap-3"}>
            {peeks.map((p, i) => (
                <div
                    key={i}
                    aria-hidden="true"
                    className={`absolute ${p.inset} ${p.top} ${BOTTOM[depth - p.drop]} rounded-lg bg-brand-800 ${p.shadow}`}
                />
            ))}

            {stacked ? (
                /* Tapping the card opens the stack — but not when the tap was on
                   one of its own controls, which have their own jobs. A wrapper
                   with a click handler rather than a <button>, because the card
                   already contains buttons and nesting them is invalid.
                
                   The containment check is what handles PORTALS. "Show me how"
                   opens the install guide, which renders into document.body but
                   is still a React child of this card — so React bubbles its
                   clicks here. Anything the guide contains (its backdrop, its
                   text) is outside this wrapper in the DOM, and expanding the
                   stack underneath an open dialog is never what was meant. */
                <div
                    ref={cardRef}
                    className="relative"
                    onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (!cardRef.current?.contains(target)) return;
                        if (target.closest("button, a")) return;
                        setExpanded(true);
                    }}
                >
                    {/* The shadow is what separates the card from the edges behind
                        it — same colour, so without it the stack reads as one card
                        with odd corners. rounded-lg matches the banner it wraps. */}
                    <div className={`cursor-pointer rounded-lg ${SHADOW}`}>{items[0].node}</div>
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
