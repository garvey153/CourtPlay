import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/utils/cx";

const THRESHOLD = 72; // px the user must pull before a release triggers a refresh
const MAX_PULL = 96; // clamp so the content can't be dragged arbitrarily far
const RESISTANCE = 0.5; // finger travel → content travel ratio (rubber-band feel)

/** Nearest scrollable ancestor — the element whose scrollTop tells us we're at the top. */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement ?? null;
    while (node) {
        const oy = getComputedStyle(node).overflowY;
        if (oy === "auto" || oy === "scroll") return node;
        node = node.parentElement;
    }
    return null;
}

interface PullToRefreshProps {
    /** Invoked when the user pulls past the threshold and releases. Awaited to keep the spinner up. */
    onRefresh: () => Promise<unknown> | unknown;
    children: ReactNode;
    /** Extra classes on the outer wrapper (e.g. to grow within a flex column). */
    className?: string;
    /** Extra classes on the translated content wrapper. */
    contentClassName?: string;
}

/**
 * Wraps scrollable content and adds a touch pull-to-refresh gesture: when the
 * scroll container is at the top and the user drags down, the content follows
 * the finger (with resistance) and a spinner shows; releasing past the threshold
 * runs onRefresh. Only the wrapped content moves — the app header stays fixed.
 */
export function PullToRefresh({ onRefresh, children, className, contentClassName }: PullToRefreshProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    // Refs mirror state so the (once-attached) touch listeners never read stale values.
    const pullRef = useRef(0);
    const refreshingRef = useRef(false);
    const startY = useRef<number | null>(null);
    const active = useRef(false);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    const setPullBoth = (v: number) => {
        pullRef.current = v;
        setPull(v);
    };
    const setRefreshingBoth = (v: boolean) => {
        refreshingRef.current = v;
        setRefreshing(v);
    };

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const scroller = getScrollParent(el);
        const atTop = () => (scroller ? scroller.scrollTop <= 0 : window.scrollY <= 0);

        const onStart = (e: TouchEvent) => {
            if (refreshingRef.current || e.touches.length !== 1 || !atTop()) {
                startY.current = null;
                return;
            }
            startY.current = e.touches[0].clientY;
            active.current = false;
        };
        const onMove = (e: TouchEvent) => {
            if (refreshingRef.current || startY.current === null) return;
            const dy = e.touches[0].clientY - startY.current;
            // Cancel if scrolled off the top or the drag reverses upward.
            if (dy <= 0 || !atTop()) {
                startY.current = null;
                if (pullRef.current) setPullBoth(0);
                return;
            }
            active.current = true;
            e.preventDefault(); // hold the pull instead of letting the container scroll/rubber-band
            setPullBoth(Math.min(MAX_PULL, dy * RESISTANCE));
        };
        const onEnd = () => {
            if (refreshingRef.current) return;
            const trigger = active.current && pullRef.current >= THRESHOLD;
            startY.current = null;
            active.current = false;
            if (trigger) {
                setRefreshingBoth(true);
                setPullBoth(THRESHOLD);
                Promise.resolve(onRefreshRef.current()).finally(() => {
                    setRefreshingBoth(false);
                    setPullBoth(0);
                });
            } else if (pullRef.current) {
                setPullBoth(0);
            }
        };

        el.addEventListener("touchstart", onStart, { passive: true });
        el.addEventListener("touchmove", onMove, { passive: false });
        el.addEventListener("touchend", onEnd, { passive: true });
        el.addEventListener("touchcancel", onEnd, { passive: true });
        return () => {
            el.removeEventListener("touchstart", onStart);
            el.removeEventListener("touchmove", onMove);
            el.removeEventListener("touchend", onEnd);
            el.removeEventListener("touchcancel", onEnd);
        };
    }, []);

    const progress = Math.min(1, pull / THRESHOLD);

    return (
        <div ref={wrapRef} className={cx("relative", className)}>
            {/* Spinner revealed in the gap that opens as the content translates down. */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden"
                style={{ height: pull }}
                aria-hidden={!refreshing}
            >
                <div
                    className={cx(
                        "size-6 rounded-full border-2 border-secondary border-t-transparent",
                        refreshing && "animate-spin",
                    )}
                    style={refreshing ? undefined : { opacity: progress, transform: `rotate(${progress * 270}deg)` }}
                    role={refreshing ? "status" : undefined}
                    aria-label={refreshing ? "Refreshing feed" : undefined}
                />
            </div>
            <div
                className={contentClassName}
                style={{
                    transform: `translateY(${pull}px)`,
                    // Animate the snap-back / settle; follow the finger 1:1 while dragging.
                    transition: active.current && !refreshing ? "none" : "transform 0.2s ease-out",
                }}
            >
                {children}
            </div>
        </div>
    );
}
