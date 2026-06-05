# Step 9: Build CourtPlay-Specific Components

## What to do

In the CourtPlay Design System Figma file, on the `Components` page, create the custom components that define CourtPlay's UI identity. These don't exist in Untitled UI and must be built from scratch.

Use the Figma MCP tools to create frames, set Auto Layout, apply variables, and create components.

## Components to build

### 1. SubCard

The core UI element — a card representing an open sub request.

**Frame structure (Auto Layout: horizontal, gap: 0, no padding):**

```
SubCard [component, Auto Layout: horizontal]
├── ColorBar
│   width: 4px
│   height: fill-parent
│   fill: status/open
│   corner radius: radius/sm on left corners only (top-left, bottom-left)
│
├── CardBody [Auto Layout: horizontal, padding: spacing/16 all sides, gap: spacing/12]
│   fill: bg/secondary
│   width: fill-parent
│   corner radius: radius/sm on right corners only (top-right, bottom-right)
│   │
│   ├── InfoStack [Auto Layout: vertical, gap: spacing/4]
│   │   width: fill-parent
│   │   │
│   │   ├── Title [text]
│   │   │   style: Heading/M
│   │   │   fill: text/primary
│   │   │   content: "Doubles · Saturday 9:00am"
│   │   │
│   │   └── Meta [text]
│   │       style: Body/S
│   │       fill: text/secondary
│   │       content: "Longshore Club · USTA 3.5 · 2 hrs"
│   │
│   └── RightStack [Auto Layout: vertical, gap: spacing/4, align: top-right]
│       width: hug-contents
│       │
│       ├── StatusBadge [instance — built below]
│       │
│       └── TimeAgo [text]
│           style: Body/S
│           fill: text/tertiary
│           content: "20m ago"
```

**Component properties:**
- `Status`: variant property with values `Open`, `Claimed`, `Expired`
  - Open: ColorBar fill = `status/open`, StatusBadge shows "Open"
  - Claimed: ColorBar fill = `status/claimed`, StatusBadge shows "Claimed", CardBody opacity = 0.42
  - Expired: ColorBar fill = `status/error`, StatusBadge shows "Expired"
- `Featured`: boolean property (default false)
  - When true: ColorBar gets a linear gradient fill from `brand/500` to `blue/400` (top to bottom)

**Hover state:**
- CardBody fill changes to `bg/tertiary`

---

### 2. StatusBadge

**Frame structure (Auto Layout: horizontal, gap: spacing/4, padding: 4px vertical / 8px horizontal):**

```
StatusBadge [component, Auto Layout: horizontal]
├── Dot [frame]
│   width: 6px, height: 6px
│   corner radius: radius/full
│   fill: varies by status
│
└── Label [text]
    style: Label/S
    fill: varies by status
    content: varies by status
```

**Component properties:**
- `Status`: variant property with values `Open`, `Claimed`, `Expired`

**Token mapping per variant:**

| Variant | Badge fill (bg) | Dot fill | Label fill | Label text |
|---------|----------------|----------|------------|------------|
| Open | status/open-bg | status/open | status/open | "Open" |
| Claimed | status/claimed-bg | status/claimed | status/claimed | "Claimed" |
| Expired | status/error-bg | status/error | status/error | "Expired" |

Badge corner radius: `radius/sm`

---

### 3. NavBar

**Frame structure (Auto Layout: horizontal, justify: space-between, padding: spacing/16 vertical / spacing/24 horizontal):**

```
NavBar [component, Auto Layout: horizontal, justify: space-between, align: center]
fill: bg/primary
border-bottom: 1px solid, stroke: border/secondary
width: fill-parent (set to stretch)
│
├── LeftGroup [Auto Layout: horizontal, gap: spacing/12, align: center]
│   │
│   ├── Logomark [frame, 20x24px]
│   │   (placeholder rectangle or SVG of the tennis racquet mark)
│   │   fill: icon/primary
│   │
│   └── Wordmark [Auto Layout: horizontal, gap: 0]
│       ├── "COURT" [text, style: Label/M, fill: text/primary]
│       └── "SUB" [text, style: Label/M, fill: text/brand]
│
└── RightGroup [Auto Layout: horizontal, gap: spacing/8, align: center]
    ├── Button [Ghost variant, instance] — text: "Browse"
    └── Button [Primary variant, instance] — text: "Post a sub need"
```

**Component properties:**
- `Show CTA`: boolean (default true) — toggles visibility of the "Post a sub need" button

---

### 4. PostForm

**Frame structure (Auto Layout: vertical, padding: spacing/24, gap: spacing/16):**

```
PostForm [component, Auto Layout: vertical]
fill: bg/secondary
corner radius: radius/md
width: 360px (fixed for sidebar context)
│
├── FormTitle [text]
│   style: Heading/L
│   fill: text/primary
│   content: "Post a sub need"
│
├── FieldStack [Auto Layout: vertical, gap: spacing/12]
│   ├── Input [instance] — label: "Date & time"
│   ├── Select [instance] — label: "Court"
│   ├── Select [instance] — label: "Level"
│   ├── Select [instance] — label: "Duration"
│   └── Input [instance] — label: "Notes (optional)"
│
└── Button [Primary variant, instance, full-width] — text: "Post sub need"
```

**Component properties:**
- `Show Notes`: boolean (default false) — toggles the Notes field

---

### 5. LiveCounter

The pulsing green dot + count indicator.

**Frame structure (Auto Layout: horizontal, gap: spacing/4, align: center):**

```
LiveCounter [component, Auto Layout: horizontal, gap: spacing/4, align: center]
│
├── PulseDot [frame]
│   width: 6px, height: 6px
│   corner radius: radius/full
│   fill: status/open
│
└── CountText [text]
    style: Body/S
    fill: text/brand
    content: "4 open"
```

**Component properties:**
- None — this is a simple composed element. Content is overridden per instance.

---

### 6. StatCard

**Frame structure (Auto Layout: vertical, padding: spacing/16, gap: spacing/4):**

```
StatCard [component, Auto Layout: vertical]
fill: bg/secondary
corner radius: radius/sm
│
├── Number [text]
│   style: Display/M
│   fill: varies (text/brand or accent/blue)
│   content: "24"
│
└── Label [text]
    style: Label/S
    fill: text/tertiary
    content: "Players nearby"
```

**Component properties:**
- `Color`: variant property with values `Green`, `Blue`
  - Green: Number fill = `text/brand`
  - Blue: Number fill = `accent/blue`

---

## Rules

- Use ONLY semantic tokens from the `Tokens` collection for all color assignments — never use `_Primitives` directly.
- Use spacing and radius variables from `_Primitives` for all padding, gap, and corner radius values.
- Apply the correct text styles (created in Step 6) to all text layers.
- Where components nest other components (e.g., SubCard contains StatusBadge, NavBar contains Button), use **instances** of those components — not detached copies.
- All components should use Auto Layout for responsive behavior.
- After creation, test each component by switching the parent frame's variable mode between Dark and Light. Log any layers that don't update (indicating a hardcoded color).
- Log a summary of all components created with their variant/property counts.
