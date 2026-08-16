/**
 * The four glyphs inside the install guide's discs, traced from the Figma
 * assets exported off 659:2070 rather than approximated with Untitled UI icons.
 *
 * Untitled UI's Share02, ChevronDown and PlusSquare are drawn on a 24 grid with
 * their own proportions and per-glyph default stroke weights, and none of them
 * matched: the share and chevron in particular are visibly different shapes.
 *
 * Everything here shares ONE 28x28 viewBox — the disc's own coordinate space, as
 * Figma composes it. That has a useful consequence: rendered at 28px, one user
 * unit is one CSS pixel, so `stroke-width="1"` is exactly 1px on screen for
 * every glyph, which is the thing that was inconsistent before.
 *
 * Each path is translated so its drawn extent is centred in the 28 box.
 */
const COMMON = {
    viewBox: "0 0 28 28",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

export type StepGlyph = (props: { className?: string }) => React.ReactElement;

/** dots-horizontal. Already centred in Figma's 28 space; filled AND stroked, as exported. */
export const DotsGlyph: StepGlyph = ({ className }) => (
    <svg {...COMMON} className={className} aria-hidden="true">
        <path
            d="M14.0007 14.934C14.5162 14.934 14.934 14.5162 14.934 14.0007C14.934 13.4852 14.5162 13.0674 14.0007 13.0674C13.4852 13.0674 13.0674 13.4852 13.0674 14.0007C13.0674 14.5162 13.4852 14.934 14.0007 14.934Z"
            fill="currentColor"
        />
        <path
            d="M19.3674 14.934C19.8828 14.934 20.3007 14.5162 20.3007 14.0007C20.3007 13.4852 19.8828 13.0674 19.3674 13.0674C18.8519 13.0674 18.434 13.4852 18.434 14.0007C18.434 14.5162 18.8519 14.934 19.3674 14.934Z"
            fill="currentColor"
        />
        <path
            d="M8.6345 14.934C9.14996 14.934 9.56783 14.5162 9.56783 14.0007C9.56783 13.4852 9.14996 13.0674 8.6345 13.0674C8.11903 13.0674 7.70116 13.4852 7.70116 14.0007C7.70116 14.5162 8.11903 14.934 8.6345 14.934Z"
            fill="currentColor"
        />
    </svg>
);

/** share-02 — the iOS share glyph: 13x15, centred. */
export const ShareGlyph: StepGlyph = ({ className }) => (
    <svg {...COMMON} className={className} aria-hidden="true">
        <g transform="translate(7.5 6.5)">
            <path d="M3.16671 5.55556C2.54673 5.55556 2.23674 5.55556 1.9824 5.62015C1.29222 5.79546 0.753125 6.30647 0.56819 6.96071C0.500042 7.2018 0.500042 7.49564 0.500042 8.08333L0.500042 11.4667C0.500042 12.5284 0.500042 13.0593 0.718029 13.4649C0.909775 13.8216 1.21574 14.1116 1.59206 14.2934C2.01988 14.5 2.57994 14.5 3.70004 14.5H9.30004C10.4201 14.5 10.9802 14.5 11.408 14.2934C11.7843 14.1116 12.0903 13.8216 12.2821 13.4649C12.5 13.0593 12.5 12.5284 12.5 11.4667V8.08333C12.5 7.49564 12.5 7.2018 12.4319 6.96071C12.247 6.30647 11.7079 5.79546 11.0177 5.62015C10.7633 5.55556 10.4534 5.55556 9.83338 5.55556M3.83338 3.02778L6.50004 0.5L9.16671 3.02778M6.50004 0.5V9.25" />
        </g>
    </svg>
);

/** chevron-down, drawn 5..19 x / 9..16 y on a 24 grid; offset to centre that extent. */
export const ChevronGlyph: StepGlyph = ({ className }) => (
    <svg {...COMMON} className={className} aria-hidden="true">
        <g transform="translate(2 1.5)">
            <path d="M5 9L12 16L19 9" />
        </g>
    </svg>
);

/** plus-square — 15x15, centred. */
export const PlusSquareGlyph: StepGlyph = ({ className }) => (
    <svg {...COMMON} className={className} aria-hidden="true">
        <g transform="translate(6.5 6.5)">
            <path d="M7.5 4.38889V10.6111M4.38889 7.5H10.6111M4.23333 14.5H10.7667C12.0735 14.5 12.7269 14.5 13.226 14.2457C13.665 14.022 14.022 13.665 14.2457 13.226C14.5 12.7269 14.5 12.0735 14.5 10.7667V4.23333C14.5 2.92654 14.5 2.27315 14.2457 1.77402C14.022 1.33498 13.665 0.978023 13.226 0.754318C12.7269 0.5 12.0735 0.5 10.7667 0.5H4.23333C2.92654 0.5 2.27315 0.5 1.77402 0.754318C1.33498 0.978023 0.978023 1.33498 0.754318 1.77402C0.5 2.27315 0.5 2.92654 0.5 4.23333V10.7667C0.5 12.0735 0.5 12.7269 0.754318 13.226C0.978023 13.665 1.33498 14.022 1.77402 14.2457C2.27315 14.5 2.92654 14.5 4.23333 14.5Z" />
        </g>
    </svg>
);
