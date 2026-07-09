import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "@/utils/cx";

// A wheel-style time picker: three snap-scrolling columns (hour, minute, AM/PM).
// The row centered on the highlight line in each column is the selected value.

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = [0, 15, 30, 45];
const MERIDIEM = ["AM", "PM"];

const ITEM_H = 36; // row height (h-9)
const VISIBLE = 5; // odd, so there's a clear centre row
const COL_H = ITEM_H * VISIBLE;
const PAD = (COL_H - ITEM_H) / 2; // spacer so the first/last item can reach the centre

interface Indices {
    hour: number;
    minute: number;
    meridiem: number;
}

function parse(value: string | null): Indices {
    const [h, m] = (value ?? "09:00").split(":").map(Number);
    const meridiem = h >= 12 ? 1 : 0;
    const hour = HOURS.indexOf(h % 12 || 12);
    // Snap the minute to the nearest quarter.
    let minute = 0;
    let best = Infinity;
    MINUTES.forEach((mm, i) => {
        const d = Math.abs(mm - m);
        if (d < best) {
            best = d;
            minute = i;
        }
    });
    return { hour: hour < 0 ? 0 : hour, minute, meridiem };
}

function toValue({ hour, minute, meridiem }: Indices): string {
    let h = HOURS[hour] % 12;
    if (meridiem === 1) h += 12;
    return `${String(h).padStart(2, "0")}:${String(MINUTES[minute]).padStart(2, "0")}`;
}

function label(value: string | null): string {
    const { hour, minute, meridiem } = parse(value);
    return `${HOURS[hour]}:${String(MINUTES[minute]).padStart(2, "0")} ${MERIDIEM[meridiem]}`;
}

interface ColumnProps {
    items: string[];
    activeIndex: number;
    onActive: (index: number) => void;
    onCommit: () => void;
    className?: string;
}

function ScrollColumn({ items, activeIndex, onActive, onCommit, className }: ColumnProps) {
    const ref = useRef<HTMLDivElement>(null);
    const commitTimer = useRef<number | undefined>(undefined);
    const rafRef = useRef<number | undefined>(undefined);

    // Centre the active row when the picker first opens.
    useLayoutEffect(() => {
        if (ref.current) ref.current.scrollTop = activeIndex * ITEM_H;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleScroll = () => {
        if (!ref.current) return;
        const el = ref.current;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const index = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
            onActive(index);
        });
        // Commit the value once scrolling settles (snap has landed).
        window.clearTimeout(commitTimer.current);
        commitTimer.current = window.setTimeout(onCommit, 120);
    };

    return (
        <div
            ref={ref}
            onScroll={handleScroll}
            className={cx(
                "snap-y snap-mandatory overflow-y-auto outline-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                className,
            )}
            style={{ height: COL_H }}
        >
            <div style={{ height: PAD }} aria-hidden="true" />
            {items.map((item, i) => {
                const dist = Math.abs(i - activeIndex);
                return (
                    <div
                        key={item}
                        onClick={() => ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" })}
                        className={cx(
                            "flex snap-center cursor-pointer items-center justify-center text-sm tabular-nums transition-opacity",
                            i === activeIndex ? "font-medium text-primary" : "text-tertiary",
                            dist === 1 && "opacity-80",
                            dist === 2 && "opacity-55",
                            dist > 2 && "opacity-35",
                        )}
                        style={{ height: ITEM_H }}
                    >
                        {item}
                    </div>
                );
            })}
            <div style={{ height: PAD }} aria-hidden="true" />
        </div>
    );
}

interface TimeFieldSelectProps {
    /** "HH:MM" (24h) or null. */
    value: string | null;
    onChange: (value: string) => void;
    isDisabled?: boolean;
    "aria-label"?: string;
    /** Applied to the field container (e.g. width). */
    className?: string;
}

/**
 * A time field that opens a wheel picker (hour / minute / AM-PM) below it. Same field
 * and menu surface as the other dropdowns; stays open + fixed to the field on page scroll.
 */
export function TimeFieldSelect({ value, onChange, isDisabled, className, ...props }: TimeFieldSelectProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const [idx, setIdx] = useState<Indices>(() => parse(value));
    const idxRef = useRef(idx);
    const update = (partial: Partial<Indices>) => {
        setIdx((prev) => {
            const next = { ...prev, ...partial };
            idxRef.current = next;
            return next;
        });
    };

    // Re-sync from the value each time the picker opens.
    useEffect(() => {
        if (open) {
            const next = parse(value);
            idxRef.current = next;
            setIdx(next);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Close on outside pointer (capture, to beat other fields' menus) or Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onDown, true);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown, true);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const commit = () => onChange(toValue(idxRef.current));

    return (
        <div ref={rootRef} className={cx("relative", className)}>
            <button
                type="button"
                aria-label={props["aria-label"] ?? "Time"}
                aria-expanded={open}
                disabled={isDisabled}
                onClick={() => !isDisabled && setOpen((o) => !o)}
                className="flex h-9 w-full cursor-pointer items-center rounded-lg bg-tertiary px-3 text-sm text-primary shadow-xs outline-hidden ring-1 ring-neutral-600 transition duration-100 ease-linear ring-inset disabled:cursor-not-allowed disabled:opacity-50"
            >
                <span className="truncate">{label(value)}</span>
            </button>

            {open && (
                // Manual dropdown (like the date calendar) so it stays open + fixed to the
                // field while the page scrolls. bg-primary + secondary_alt ring match the menus.
                <div className="absolute top-full right-0 z-40 mt-1 flex rounded-lg bg-primary px-1 shadow-lg ring-1 ring-secondary_alt">
                    {/* Centre highlight line — the row on it is the selected value. */}
                    <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md bg-secondary" style={{ height: ITEM_H }} />
                    <ScrollColumn
                        items={HOURS.map(String)}
                        activeIndex={idx.hour}
                        onActive={(i) => update({ hour: i })}
                        onCommit={commit}
                        className="relative w-12"
                    />
                    <ScrollColumn
                        items={MINUTES.map((m) => String(m).padStart(2, "0"))}
                        activeIndex={idx.minute}
                        onActive={(i) => update({ minute: i })}
                        onCommit={commit}
                        className="relative w-12"
                    />
                    <ScrollColumn
                        items={MERIDIEM}
                        activeIndex={idx.meridiem}
                        onActive={(i) => update({ meridiem: i })}
                        onCommit={commit}
                        className="relative w-12"
                    />
                </div>
            )}
        </div>
    );
}
