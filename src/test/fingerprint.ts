import { createHash } from "node:crypto";

/**
 * A structural fingerprint of a rendered tree, used to detect that a tutorial
 * screenshot has gone stale.
 *
 * What it deliberately DOES include: tag names, class tokens (sorted, so a
 * reorder inside cx() is not a false alarm), and the handful of attributes that
 * carry meaning rather than identity.
 *
 * What it deliberately EXCLUDES, and why:
 *   style   Motion writes inline transforms that differ frame to frame.
 *   id, aria-labelledby, aria-describedby, for
 *           React's useId emits ":r0:"-style values that shift with render
 *           order — they encode nothing about how the UI looks.
 *   src     avatar URLs get a "?t=" cache-buster appended on upload.
 *
 * KNOWN GAP, stated so nobody mistakes this for visual regression testing: a
 * pure colour change — redefining a token in globals.css without touching a
 * class name — moves no bytes here and will not be caught. This is a smoke
 * alarm for structural drift, not a pixel diff.
 */
const KEPT_ATTRS = ["role", "type", "alt", "aria-current", "aria-roledescription", "aria-label"];

export function serializeElement(root: Element): string {
    const lines: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
            if (text) lines.push(`#text ${text}`);
            continue;
        }

        const el = node as Element;
        const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).sort().join(" ");
        const attrs = KEPT_ATTRS.map((a) => (el.hasAttribute(a) ? `${a}=${el.getAttribute(a)}` : null))
            .filter(Boolean)
            .join(" ");
        const dataAttrs = [...el.attributes]
            .filter((a) => a.name.startsWith("data-"))
            .map((a) => `${a.name}=${a.value}`)
            .sort()
            .join(" ");
        lines.push([el.tagName.toLowerCase(), classes, attrs, dataAttrs].filter(Boolean).join(" | "));
    }

    return lines.join("\n");
}

export function fingerprintElement(root: Element): string {
    return createHash("sha256").update(serializeElement(root)).digest("hex").slice(0, 16);
}
