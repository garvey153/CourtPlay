# Create SubCardV2 in CourtPlay Design System

## What to do

In the CourtPlay Design System Figma file, on the `Components` page, create a new component called `SubCardV2`. This is the feed card for sub requests. Use existing tokens, text styles, and component instances already in the file — do not create new styles or tokens.

Read the file first to identify existing variable IDs, component IDs, and text style IDs before building.

---

## Layout

The card is a horizontal flex container. A narrow color bar on the left, content stacked vertically on the right. The poster row sits at the bottom of the card, separated by a thin divider.

```
SubCardV2 [Auto Layout: horizontal, padding: 0, gap: 0, radius: radius/md]
│
├── ColorBar [width: 4px, height: fill-parent]
│   fill: status/open (default)
│   radius: radius/sm on top-left and bottom-left only
│
└── CardBody [Auto Layout: vertical, padding: spacing/16 all sides, gap: spacing/8, width: fill-parent]
    fill: bg/secondary
    radius: radius/sm on top-right and bottom-right only
    │
    ├── HeaderRow [Auto Layout: horizontal, justify: space-between, align: center]
    │   │
    │   ├── DateTimeGroup [Auto Layout: horizontal, gap: spacing/8, align: center]
    │   │   ├── DayDate [text: "Sat, Apr 12"]
    │   │   │   text style: Heading/M
    │   │   │   fill: text/primary
    │   │   │
    │   │   ├── Time [text: "9:00 AM"]
    │   │   │   text style: Body/M
    │   │   │   fill: text/secondary
    │   │   │
    │   │   └── CountdownBadge [Auto Layout: horizontal, padding: 2px 6px, radius: radius/sm]
    │   │       fill: bg/warning-subtle
    │   │       └── CountdownText [text: "Game in 4h"]
    │   │           text style: Label/S
    │   │           fill: text/warning
    │   │
    │   └── StatusBadge [instance of existing StatusBadge component]
    │
    ├── LocationRow [Auto Layout: horizontal, gap: spacing/4, align: center]
    │   ├── LocationIcon [16x16 pin icon, fill: icon/secondary]
    │   └── LocationText [text: "Longshore Club"]
    │       text style: Body/S
    │       fill: text/secondary
    │
    ├── MetaRow [Auto Layout: horizontal, gap: spacing/8, align: center, wrap: true]
    │   ├── FormatBadge [Auto Layout: horizontal, padding: 2px 8px, radius: radius/sm]
    │   │   fill: bg/tertiary
    │   │   └── Text [text: "Doubles"]
    │   │       text style: Label/S
    │   │       fill: text/secondary
    │   │
    │   ├── SkillBadge [same structure as FormatBadge]
    │   │   └── Text [text: "USTA 3.5"]
    │   │
    │   ├── Cost [text: "$25"]
    │   │   text style: Body/S
    │   │   fill: text/primary
    │   │   font-weight: 600
    │   │
    │   └── SpotsIndicator [text: "2/4 avail"]
    │       text style: Body/S
    │       fill: text/secondary
    │
    └── PosterRow [Auto Layout: horizontal, justify: space-between, align: center, padding-top: spacing/8]
        border-top: 0.5px solid border/secondary
        │
        ├── PosterGroup [Auto Layout: horizontal, gap: spacing/8, align: center]
        │   ├── Avatar [instance of existing Avatar component, S variant]
        │   └── PosterName [text: "Chris B."]
        │       text style: Body/S
        │       fill: text/secondary
        │
        └── RightMeta [Auto Layout: horizontal, gap: spacing/8, align: center]
            ├── ViewCount [text: "14 views"]
            │   text style: Mono/S
            │   fill: text/tertiary
            │
            ├── Separator [text: "·"]
            │   fill: text/tertiary
            │   opacity: 0.3
            │
            └── TimeAgo [text: "20m ago"]
                text style: Mono/S
                fill: text/tertiary
```

---

## Component properties

Create these properties on the SubCardV2 component:

| Property | Type | Values | Default | What it controls |
|----------|------|--------|---------|-----------------|
| Status | Variant | Open, Claimed, Expired | Open | ColorBar fill, StatusBadge variant, card opacity |
| Featured | Boolean | true / false | false | ColorBar switches to gradient fill |
| Show Countdown | Boolean | true / false | false | CountdownBadge visibility |
| Countdown Urgency | Variant | Warning, Critical | Warning | CountdownBadge colors |
| Show Discount | Boolean | true / false | false | Toggles discount price treatment |
| Show Friend | Boolean | true / false | false | Shows Friend badge next to poster name |
| Last Spot | Boolean | true / false | false | SpotsIndicator color changes |

---

## Property effects in detail

### Status = Open (default)
- ColorBar fill: `status/open`
- StatusBadge: Open variant
- Card opacity: 1.0

### Status = Claimed
- ColorBar fill: `status/claimed`
- StatusBadge: Claimed variant
- Card opacity: 0.42

### Status = Expired
- ColorBar fill: `status/error`
- StatusBadge: Expired variant
- Card opacity: 0.42

### Featured = true
- ColorBar fill becomes a linear gradient: top = `brand/500` (#1DB967), bottom = `blue/400` (#60A5FA)
- Only applies when Status = Open

### Show Countdown = true
- CountdownBadge becomes visible in the HeaderRow after the Time text

### Countdown Urgency = Warning
- CountdownBadge fill: `bg/warning-subtle`
- CountdownBadge text fill: `text/warning`
- Example text: "Game in 6h"

### Countdown Urgency = Critical
- CountdownBadge fill: `bg/error-subtle`
- CountdownBadge text fill: `text/error`
- Example text: "Game in 4h"

### Show Discount = true
- Cost area shows two values:
  - Original price [text: "$30", text style: Body/S, fill: text/tertiary, strikethrough: true]
  - New price [text: "$20", text style: Body/S, fill: text/brand, font-weight: 600]

### Show Friend = true
- A Friend badge appears after the PosterName in the PosterGroup:
  - [Auto Layout: horizontal, padding: 2px 8px, radius: radius/sm]
  - fill: `accent/blue-subtle`
  - Text: "Friend", text style: Label/S, fill: `accent/blue`

### Last Spot = true
- SpotsIndicator text fill changes to `text/warning`
- SpotsIndicator font-weight: 600
- Example text: "1/4 avail"

---

## Existing components to use as instances

Read the file and find these existing components. Use instances of them inside SubCardV2 — do not recreate them:

- **StatusBadge** — has Status property with Open, Claimed, Expired variants
- **Avatar** — has Size property with S variant (28x28)

If these components don't exist yet or can't be found, create the elements inline with the same visual specs but note this in the output log.

---

## Existing tokens to use

All fills, strokes, and spacing must use existing variables from the `Tokens` and `_Primitives` collections. Read the collections first to get variable IDs.

Color tokens from `Tokens`:
- `bg/secondary`, `bg/tertiary`, `bg/warning-subtle`, `bg/error-subtle`
- `text/primary`, `text/secondary`, `text/tertiary`, `text/brand`, `text/warning`, `text/error`
- `border/secondary`
- `status/open`, `status/claimed`, `status/error`
- `icon/secondary`
- `accent/blue`, `accent/blue-subtle`

Spacing from `_Primitives`:
- `spacing/4`, `spacing/8`, `spacing/16`

Radius from `_Primitives`:
- `radius/sm`, `radius/md`

Text styles (apply if they exist, otherwise set properties directly):
- `Heading/M` — DM Sans 700, 16px
- `Body/M` — DM Sans 400, 14px
- `Body/S` — DM Sans 400, 13px
- `Label/S` — DM Sans 600, 10px, 0.2em letter-spacing, uppercase
- `Mono/S` — JetBrains Mono 500, 11px

---

## Location pin icon

Create a simple 16x16 pin icon as a vector inside the LocationRow. A basic map pin shape:
- Outer teardrop path, 1.2px stroke, no fill
- Inner small circle at the top
- Color: `icon/secondary`

---

## Rules

- Read existing variables, components, and styles from the file BEFORE creating anything.
- Use only existing tokens — do not create new variables or styles.
- Use instances of existing components (StatusBadge, Avatar) where specified.
- All Auto Layout frames must use spacing variables for padding and gap.
- All corner radii must use radius variables.
- All colors must use semantic tokens from the Tokens collection.
- The component must respond to Dark/Light mode switching on a parent frame.
- After creation, place an instance on the Playground page inside a frame with `bg/primary` fill and test mode switching.
- Log: component name, total variant/property count, list of existing components and tokens used, and whether mode switching works.
