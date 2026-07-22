import type { CSSProperties } from "react";

// A dropdown is sized to fit its longest option (and its placeholder, so the
// resting text never clips), capped to the container width. Measured with canvas so
// the width tracks the real glyph widths of the font, not a per-char estimate.
let _measureCanvas: HTMLCanvasElement | null = null;

// extraPx reserves room for a left checkbox in the option rows (24 ≈ box + gap),
// since the options popover is the same width as the trigger.
export function menuWidth(items: { label: string }[], placeholder = "", extraPx = 0): CSSProperties | undefined {
    if (typeof document === "undefined") return undefined;
    _measureCanvas ??= document.createElement("canvas");
    const ctx = _measureCanvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.font = "500 14px Inter, system-ui, sans-serif";
    const texts = [placeholder, ...items.map((i) => i.label)];
    const max = texts.reduce((m, t) => Math.max(m, ctx.measureText(t).width), 0);
    if (!max) return undefined;
    // + padding (px-3 ×2 = 24) + chevron (16) + gaps/buffer + optional checkbox room.
    return { width: `${Math.ceil(max) + 44 + extraPx}px`, maxWidth: "100%" };
}

// Width for a checkbox multi-select: fits the longest option (with checkbox room)
// and the "N selected" summary the trigger shows once items are picked.
export function multiMenuWidth(items: { label: string }[], placeholder = ""): CSSProperties | undefined {
    return menuWidth([...items, { label: `${items.length} selected` }], placeholder, 24);
}
