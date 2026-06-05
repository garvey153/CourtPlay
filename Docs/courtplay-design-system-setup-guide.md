# CourtPlay Design System — Setup Guide

A step-by-step guide for building the CourtPlay design system in Figma from scratch, using Untitled UI as acceleration scaffolding but owning the system entirely.

---

## Table of Contents

1. [File Architecture](#1-file-architecture)
2. [Generating Color Ramps](#2-generating-color-ramps)
3. [Setting Up Primitives](#3-setting-up-primitives)
4. [Setting Up Semantic Tokens](#4-setting-up-semantic-tokens)
5. [Spacing & Radius Variables](#5-spacing--radius-variables)
6. [Typography](#6-typography)
7. [Scoping & Publishing](#7-scoping--publishing)
8. [Forking Components from Untitled UI](#8-forking-components-from-untitled-ui)
9. [Building CourtPlay-Specific Components](#9-building-courtplay-specific-components)
10. [Page Structure & Organization](#10-page-structure--organization)
11. [Testing & QA](#11-testing--qa)
12. [Handoff to Code](#12-handoff-to-code)

---

## 1. File Architecture

### Create the Figma file

1. Create a new Figma file. Name it **CourtPlay Design System**.
2. This is your single source of truth. All components, variables, and styles live here.
3. Enable it as a **team library**: click the Figma logo → Libraries → publish. This lets your working design files pull from it.

### Relationship to Untitled UI

Untitled UI is a **reference file** you copy from — not a library you subscribe to. You will cherry-pick components, detach them, and rebuild them as CourtPlay components. Once forked, there is no ongoing dependency on Untitled UI.

### Page setup (do this now)

Create the following pages in your file:

| Page name | Purpose |
|-----------|---------|
| `Cover` | File thumbnail, version number, last updated date |
| `Foundations` | Color ramp swatches, typography scale, spacing/radius scale — visual documentation |
| `Components` | All CourtPlay components (SubCard, StatusBadge, NavBar, PostForm, etc.) |
| `Patterns` | Composed layouts: card list, form + sidebar, nav + content area |
| `Playground` | Scratch space for testing components in context |

---

## 2. Generating Color Ramps

CourtPlay's brand defines single anchor hex values. Untitled UI (and Tailwind CSS) expect 12-shade ramps per color family on a 25–950 numeric scale. You need to expand each anchor into a full ramp.

### Brand anchors from the CourtPlay brand spec

| Name | Hex | Role |
|------|-----|------|
| Court Green | `#1DB967` | Primary brand, CTAs, active states |
| Forest | `#0A5C35` | Deep brand accent, dark hover states |
| Electric Blue | `#2563EB` | Secondary accent, stat highlights, links |
| Sky Blue | `#60A5FA` | Light accent, gradient endpoints |
| Midnight Blue | `#0F2D6B` | Deep blue accent, dark overlays |
| Ink | `#080E0B` | Primary dark background |
| Ink 2 | `#0E1812` | Secondary dark surface |
| Ink 3 | `#162119` | Tertiary dark surface |
| Ink 4 | `#1E2E24` | Elevated dark surface |
| Paper | `#F0F5F2` | Primary light background |
| White | `#FFFFFF` | Text on dark, overlays |

### Option A — Huetone (recommended for speed)

1. Go to **huetone.ardov.me**.
2. Add a hue row. Name it "Brand."
3. Click the mid-tone swatch and paste `#1DB967`. Huetone converts it to LCH automatically.
4. Set the number of steps to **12**.
5. Adjust the **lightness curve** so the lightest swatch is ~97 L and the darkest is ~5 L. Aim for a smooth, roughly even curve.
6. Keep the **hue angle flat** across the ramp (this is LCH's strength — no drift toward yellow or cyan).
7. Allow a small **chroma dip** at the extremes (very light and very dark shades are naturally less saturated).
8. Check the APCA/WCAG contrast readouts to confirm key pairings pass (white on 500, 950 on 50).
9. Repeat for **Blue** (anchor `#2563EB` at the 600 position) and **Gray** (anchor `#1E2E24` at ~800, with the hue angle matching the green undertone from your Ink colors).
10. Click **"Copy tokens"** to export JSON.
11. Use the **"Huetone to Variables"** Figma plugin to paste the JSON directly into your Figma variable collections.

### Option B — Leonardo (recommended for contrast guarantees)

1. Go to **leonardocolor.io/theme.html** and click "Add color."
2. The first color scale defaults to "Gray" and becomes the **base/background color**. Enter `#080E0B` as the key color.
3. Use the **Lightness slider** in Theme Settings to pull the background brightness down to ~3–5% so it matches Ink.
4. Click "Add color" again for **"Brand"** (key color `#1DB967`) and again for **"Blue"** (key color `#2563EB`).
5. For each scale, switch the **Distribute** toggle to "Lightness" mode. Enter 12 lightness targets, roughly evenly spaced: `97, 93, 85, 74, 62, 50, 40, 32, 25, 18, 12, 5`.
6. Set the interpolation color space to **CAM02** or **LCH** for perceptual evenness.
7. For the brand green ramp, optionally add `#0A5C35` as a second key color to steer the dark end.
8. For the blue ramp, optionally add `#60A5FA` and `#0F2D6B` as additional key colors.
9. Ignore **"Failed"** labels on light swatches — they mean that specific swatch doesn't have enough contrast against your dark background for text use, which is expected. Focus on the contrast of pairings you'll actually use in the UI.
10. Export via the **CSS** or **Design Tokens** output in the share menu.

### Approximate ramp values (starting point)

These are reasonable interpolations. Replace with your Huetone/Leonardo output.

**Brand (Green)**

| Step | Hex |
|------|-----|
| 25 | `#ECFDF3` |
| 50 | `#D1FADF` |
| 100 | `#A6F4C5` |
| 200 | `#6CE9A6` |
| 300 | `#3FD88A` |
| 400 | `#22C66E` |
| 500 | `#1DB967` ← anchor |
| 600 | `#16944F` |
| 700 | `#0F753E` |
| 800 | `#0A5C35` ← Forest |
| 900 | `#074D2B` |
| 950 | `#053E22` |

**Blue**

| Step | Hex |
|------|-----|
| 25 | `#EFF6FF` |
| 50 | `#DBEAFE` |
| 100 | `#BFDBFE` |
| 200 | `#93C5FD` |
| 300 | `#6CB5FC` |
| 400 | `#60A5FA` ← Sky |
| 500 | `#3B82F6` |
| 600 | `#2563EB` ← Electric |
| 700 | `#1D4ED8` |
| 800 | `#1E40AF` |
| 900 | `#0F2D6B` ← Midnight |
| 950 | `#0A1E4A` |

**Gray (green-tinted neutrals)**

| Step | Hex |
|------|-----|
| 25 | `#F7FAF8` |
| 50 | `#F0F5F2` ← Paper |
| 100 | `#DCE5DF` |
| 200 | `#B8C7BD` |
| 300 | `#8FA399` |
| 400 | `#647A6E` |
| 500 | `#465A4E` |
| 600 | `#344539` |
| 700 | `#243530` |
| 800 | `#1E2E24` ← Ink 4 |
| 900 | `#0E1812` ← Ink 2 |
| 950 | `#080E0B` ← Ink |

---

## 3. Setting Up Primitives

### Create the collection

1. In your CourtPlay Design System file, open the Variables panel: right-click the canvas → **Local variables** (or click the Variables icon in the right panel).
2. Click **"Create collection."**
3. Name it **`_Primitives`**. The underscore prefix is a convention — it hides the collection from the color picker when you publish the library, so designers only see semantic tokens.

### Create color variable groups

Inside `_Primitives`, create groups by right-clicking → **"New group"**:

**`brand` group** — 12 color variables:

1. Right-click inside the collection → **New group** → name it `brand`.
2. Inside the group, click **+** to add a new variable. Name it `25`. Set the type to **Color**. Paste your brand/25 hex value.
3. Repeat for `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`.
4. The full variable path will read as `brand/25`, `brand/50`, etc.

**`blue` group** — same structure, 12 variables (`blue/25` through `blue/950`).

**`gray` group** — same structure, 12 variables (`gray/25` through `gray/950`).

**`base` group** — 2 variables:

- `base/white` → `#FFFFFF`
- `base/black` → `#000000`

### Create feedback color groups

These are for UI status states (errors, warnings, success) separate from brand:

**`error` group** — keep Untitled UI's default red ramp or use standard Tailwind red. At minimum define: `error/25`, `error/50`, `error/100`, `error/300`, `error/500`, `error/600`, `error/700`, `error/900`.

**`warning` group** — standard amber/yellow ramp, same step structure.

> **Why keep feedback colors separate from brand green?** CourtPlay's UI has status badges (Open, Claimed) and will need error/warning states for form validation, scheduling conflicts, etc. Keeping feedback colors visually distinct from brand avoids ambiguity as the product grows.

### No modes on Primitives

Primitives are raw values. They don't change between light and dark themes. Only one mode is needed (the default).

---

## 4. Setting Up Semantic Tokens

### Create the collection

1. Click **"Create collection"** again.
2. Name it **`Tokens`**.
3. Click the **+** button next to "Mode 1" to add a second mode.
4. Rename the two modes: **`Dark`** (left) and **`Light`** (right).
5. Since CourtPlay is dark-first, Dark should be the **first/default** mode.

### How to set values

For each token, the value is **not a hex code** — it's a **reference to a primitive variable**:

1. Click the value cell for a token.
2. Click the small **variable icon** (diamond shape) that appears.
3. Browse to your `_Primitives` collection.
4. Select the appropriate primitive swatch.
5. Do this separately for each mode column (Dark and Light).

### Background tokens

| Token name | Type | Dark mode → | Light mode → |
|------------|------|-------------|--------------|
| `bg/primary` | Color | `gray/950` | `base/white` |
| `bg/secondary` | Color | `gray/900` | `gray/50` |
| `bg/tertiary` | Color | `gray/800` | `gray/100` |
| `bg/brand` | Color | `brand/500` | `brand/500` |
| `bg/brand-subtle` | Color | `brand/800` | `brand/25` |
| `bg/brand-hover` | Color | `brand/600` | `brand/600` |

### Text tokens

| Token name | Type | Dark mode → | Light mode → |
|------------|------|-------------|--------------|
| `text/primary` | Color | `base/white` | `gray/950` |
| `text/secondary` | Color | `gray/300` | `gray/500` |
| `text/tertiary` | Color | `gray/400` | `gray/400` |
| `text/brand` | Color | `brand/500` | `brand/600` |
| `text/on-brand` | Color | `gray/950` | `base/white` |
| `text/on-dark` | Color | `base/white` | `base/white` |

### Border tokens

| Token name | Type | Dark mode → | Light mode → |
|------------|------|-------------|--------------|
| `border/primary` | Color | `gray/800` | `gray/200` |
| `border/secondary` | Color | `gray/900` | `gray/100` |
| `border/brand` | Color | `brand/500` | `brand/500` |

### Status tokens (CourtPlay-specific)

| Token name | Type | Dark mode → | Light mode → |
|------------|------|-------------|--------------|
| `status/open` | Color | `brand/500` | `brand/600` |
| `status/open-bg` | Color | `brand/800` | `brand/25` |
| `status/claimed` | Color | `gray/500` | `gray/400` |
| `status/claimed-bg` | Color | `gray/800` | `gray/100` |
| `status/error` | Color | `error/500` | `error/600` |
| `status/error-bg` | Color | `error/900` | `error/25` |

### Accent tokens

| Token name | Type | Dark mode → | Light mode → |
|------------|------|-------------|--------------|
| `accent/blue` | Color | `blue/400` | `blue/600` |
| `accent/blue-subtle` | Color | `blue/900` | `blue/25` |

### Icon tokens

| Token name | Type | Dark mode → | Light mode → |
|------------|------|-------------|--------------|
| `icon/primary` | Color | `base/white` | `gray/950` |
| `icon/secondary` | Color | `gray/400` | `gray/400` |
| `icon/brand` | Color | `brand/500` | `brand/600` |

### Note on opacity-based tokens

The CourtPlay brand spec uses `rgba(255,255,255,0.07)` for `--rule` and `rgba(255,255,255,0.35)` for `--muted`. Figma variables don't natively support opacity on color variables — it's the layer/fill opacity instead.

Two options:
- **Option A (recommended for V1):** Create solid-color equivalents that visually match the transparent value on its expected background. For example, `border/secondary` in dark mode can be a solid `gray/900` which approximates white at 7% on Ink.
- **Option B:** Apply the token as a color and set the opacity at the fill level manually. Document the intended opacity alongside the token in your Foundations page.

---

## 5. Spacing & Radius Variables

### Add spacing variables to `_Primitives`

Create a group called **`spacing`** inside `_Primitives`. Type = **Number**.

| Variable | Value | Usage |
|----------|-------|-------|
| `spacing/2` | 2 | Hairline gaps |
| `spacing/4` | 4 | Tight inner padding |
| `spacing/8` | 8 | Default inner padding, icon gaps |
| `spacing/12` | 12 | Compact component padding |
| `spacing/16` | 16 | Standard component padding |
| `spacing/20` | 20 | Medium component padding |
| `spacing/24` | 24 | Card internal padding |
| `spacing/32` | 32 | Section separation |
| `spacing/48` | 48 | Large section separation |
| `spacing/64` | 64 | Page-level spacing |

Apply these to Auto Layout padding and gap fields. Select a frame → in the Auto Layout settings, click the gap or padding value → press **=** → select from your spacing variables.

### Add radius variables to `_Primitives`

Create a group called **`radius`** inside `_Primitives`. Type = **Number**.

| Variable | Value | Usage |
|----------|-------|-------|
| `radius/none` | 0 | Square elements |
| `radius/sm` | 2 | Subtle rounding (badges, inputs) |
| `radius/md` | 4 | Default rounding (cards, buttons) |
| `radius/lg` | 8 | Larger rounding (modals, overlays) |
| `radius/full` | 999 | Pill shapes, avatars |

> CourtPlay's brand aesthetic is **sharp and utilitarian** — the brand spec uses 2–3px radii throughout. Favor `radius/sm` and `radius/md` for most components. Reserve `radius/lg` for modals or overlays where softer edges reduce visual tension.

---

## 6. Typography

### Font families

From the CourtPlay brand spec:

| Font | Weight range | Usage |
|------|-------------|-------|
| **Outfit** | 300–900 | Display text: hero, wordmarks, section headers, stat numbers |
| **DM Sans** | 400–700 | Body text: UI labels, metadata, form fields, buttons |

### Type scale

Define these as **text styles** (not variables — Figma typography variables are still maturing and text styles are more reliable for most workflows):

| Style name | Font | Weight | Size | Line height | Letter spacing | Usage |
|------------|------|--------|------|-------------|----------------|-------|
| `Display/XL` | Outfit | 900 | 72px | 0.92 | 0.04em | Hero wordmark only |
| `Display/L` | Outfit | 800 | 48px | 1.0 | 0.02em | Section headers |
| `Display/M` | Outfit | 700 | 32px | 1.1 | 0.01em | Card-level headers |
| `Display/S` | Outfit | 700 | 24px | 1.2 | 0em | Sub-headers |
| `Heading/L` | Outfit | 600 | 18px | 1.3 | -0.01em | Pane titles |
| `Heading/M` | DM Sans | 700 | 16px | 1.4 | 0em | Card titles |
| `Body/M` | DM Sans | 400 | 14px | 1.55 | 0em | Default body text |
| `Body/S` | DM Sans | 400 | 13px | 1.5 | 0em | Secondary text, metadata |
| `Label/M` | DM Sans | 600 | 12px | 1.3 | 0.12em | Button labels, uppercase |
| `Label/S` | DM Sans | 600 | 10px | 1.3 | 0.2em | Kickers, tags, uppercase |
| `Mono/S` | JetBrains Mono | 500 | 11px | 1.4 | 0.02em | Technical labels, timestamps |

### Creating text styles

1. Select a text layer with the correct font, size, weight, line height, and letter spacing.
2. In the right panel under "Text," click the **style icon** (four dots).
3. Click **+** to create a new style.
4. Name it using the convention above (e.g., `Display/XL`).
5. Repeat for each style.

### Applying color to text

Do **not** bake color into text styles. Apply color separately using your `text/*` semantic tokens. This keeps typography and color as independent axes — you can change one without breaking the other.

---

## 7. Scoping & Publishing

### Scope your variables

Right-click each variable → **Edit variable** → set **Scoping** to restrict where it can be applied:

| Token group | Allowed scopes |
|-------------|---------------|
| `bg/*` | Fill only |
| `text/*` | Fill only (applies to text fill) |
| `border/*` | Stroke only |
| `icon/*` | Fill only |
| `status/*` | Fill only |
| `accent/*` | Fill, Stroke |
| `spacing/*` | Gap, Padding |
| `radius/*` | Corner radius |

This prevents misuse — nobody can accidentally apply a background token to text.

### Hide primitives from publishing

1. Go to the `_Primitives` collection.
2. Right-click the collection name → **Edit collection**.
3. Check **"Hide from publishing."**

When your library is consumed in other files, only the `Tokens` collection and your text styles show up. Designers pick from semantic names, never raw hex values.

### Set Code Syntax on variables

For each variable in the `Tokens` collection:

1. Right-click → **Edit variable**.
2. Under **Code syntax**, set the CSS custom property name.
3. Example: `bg/primary` → `--bg-primary`, `text/brand` → `--text-brand`.

This ensures Dev Mode handoff shows clean CSS variable names instead of Figma-internal paths.

---

## 8. Forking Components from Untitled UI

### What to bring over for V1

Only fork what the CourtPlay PWA actually needs. Audit the UI spec and identify the minimum set:

| Component | Source in Untitled UI | CourtPlay name |
|-----------|-----------------------|---------------|
| Button | Button (Primary, Secondary, Ghost) | `Button` |
| Badge | Badge | `StatusBadge` |
| Input | Input field | `Input` |
| Select / Dropdown | Select | `Select` |
| Toggle | Toggle | `Toggle` |
| Avatar | Avatar | `Avatar` |
| Modal / Dialog | Modal | `Modal` |
| Toast / Notification | Toast | `Toast` |

### Forking process (per component)

1. **Open your Untitled UI file** (the reference copy).
2. **Find the component** you want. Select it.
3. **Copy it** (Cmd/Ctrl + C).
4. **Switch to your CourtPlay Design System file**, navigate to the `Components` page.
5. **Paste it** (Cmd/Ctrl + V). It will arrive as an instance of the Untitled UI component.
6. **Right-click → Detach instance.** This breaks the link to Untitled UI. The component is now a regular frame.
7. **Create a new component** from it: select the frame → Cmd/Ctrl + Alt + K.
8. **Rename it** using CourtPlay naming (e.g., `Button`, not `Untitled UI / Button`).
9. **Rewire all colors** to use your CourtPlay `Tokens` variables:
   - Select each layer with a fill → click the fill color → click the variable icon → browse to `Tokens` → select the appropriate semantic token.
   - Do this for fills, strokes, and text colors.
   - Do **not** apply primitives. Only use semantic tokens.
10. **Rewire spacing**: Select Auto Layout frames → replace hardcoded padding and gap values with your `spacing/*` variables (click the value → press `=` → select variable).
11. **Rewire radii**: Select frames with corner radius → replace with `radius/*` variables.
12. **Set up component properties**: Add Figma component properties for variants (e.g., Button gets `Type = Primary | Secondary | Ghost`, `Size = M | S`, `State = Default | Hover | Disabled`). Use boolean properties for optional elements (e.g., `Show icon = true/false`).
13. **Test both modes**: Select the component → in the right panel, switch variable mode between Dark and Light. Confirm all colors update correctly.

### What not to fork

Don't bring over:
- Page layout templates (420+ page examples)
- Marketing sections
- Components you won't use in V1 (charts, calendars, file uploaders, etc.)
- Icon sets (import only the icons you need as individual SVGs)

---

## 9. Building CourtPlay-Specific Components

These components don't exist in Untitled UI and must be built from scratch. They are what make CourtPlay feel like CourtPlay.

### SubCard

The core UI element — a card representing an open sub request.

**Structure (Auto Layout, vertical):**

```
SubCard [Auto Layout: horizontal, padding: 0, gap: 0]
├── ColorBar [fixed width: 4px, fill: status/open or status/claimed, radius: radius/sm 0 0 radius/sm]
├── CardBody [Auto Layout: horizontal, padding: spacing/16, gap: spacing/12, fill: bg/secondary]
│   ├── InfoStack [Auto Layout: vertical, gap: spacing/4]
│   │   ├── Title [text style: Heading/M, fill: text/primary] — "Doubles · Saturday 9:00am"
│   │   └── Meta [text style: Body/S, fill: text/secondary] — "Longshore Club · USTA 3.5 · 2 hrs"
│   └── RightStack [Auto Layout: vertical, align: right, gap: spacing/4]
│       ├── StatusBadge [component instance]
│       └── TimeAgo [text style: Body/S, fill: text/tertiary] — "20m ago"
```

**Component properties:**
- `Status` = `Open | Claimed | Expired` (controls ColorBar fill and badge variant)
- `Featured` = boolean (adds a gradient to the ColorBar: `brand/500` → `blue/400`)

**Interaction states:**
- Default: as above
- Hover: `bg/tertiary` on CardBody

### StatusBadge

**Structure:**

```
StatusBadge [Auto Layout: horizontal, padding: spacing/4 spacing/8, gap: spacing/4, radius: radius/sm]
├── Dot [4x4 circle, fill varies by status]
└── Label [text style: Label/S, fill varies by status]
```

**Component properties:**
- `Status` = `Open | Claimed | Expired`

**Token mapping per variant:**

| Variant | Badge bg | Dot fill | Label fill |
|---------|----------|----------|------------|
| Open | `status/open-bg` | `status/open` | `status/open` |
| Claimed | `status/claimed-bg` | `status/claimed` | `status/claimed` |
| Expired | `status/error-bg` | `status/error` | `status/error` |

### NavBar

**Structure:**

```
NavBar [Auto Layout: horizontal, justify: space-between, padding: spacing/16 spacing/24, fill: bg/primary, border-bottom: border/secondary]
├── LeftGroup [Auto Layout: horizontal, gap: spacing/12, align: center]
│   ├── Logomark [SVG, 20x24]
│   └── Wordmark [text: "COURTPLAY", style: Label/M]
│       ├── "COURT" [fill: text/primary]
│       └── "SUB" [fill: text/brand]
└── RightGroup [Auto Layout: horizontal, gap: spacing/8, align: center]
    ├── Button [Ghost variant] — "Browse"
    └── Button [Primary variant] — "Post a sub need"
```

### PostForm

**Structure:**

```
PostForm [Auto Layout: vertical, padding: spacing/24, gap: spacing/16, fill: bg/secondary, radius: radius/md]
├── FormTitle [text style: Heading/L, fill: text/primary] — "Post a sub need"
├── FieldStack [Auto Layout: vertical, gap: spacing/12]
│   ├── Input [Date & time]
│   ├── Input [Court — Select variant]
│   ├── Input [Level — Select variant]
│   ├── Input [Duration — Select variant]
│   └── Input [Notes — optional, multi-line]
└── Button [Primary, full-width] — "Post sub need"
```

### LiveCounter

The pulsing green dot + count indicator used throughout the UI.

**Structure:**

```
LiveCounter [Auto Layout: horizontal, gap: spacing/4, align: center]
├── PulseDot [6x6 circle, fill: status/open, animated glow in code]
└── Count [text style: Body/S, fill: text/brand] — "4 open"
```

### StatCard

**Structure:**

```
StatCard [Auto Layout: vertical, padding: spacing/16, gap: spacing/4, fill: bg/secondary, radius: radius/sm]
├── Number [text style: Display/M, fill varies] — "24"
└── Label [text style: Label/S, fill: text/tertiary] — "Players nearby"
```

**Component properties:**
- `Color` = `Green | Blue` (controls Number fill: `text/brand` or `accent/blue`)

---

## 10. Page Structure & Organization

### Components page layout

Organize the Components page spatially:

```
┌─────────────────────────────────────────────┐
│  PRIMITIVES (reference only)                │
│  Button  StatusBadge  Input  Select  Toggle │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  COURTPLAY-SPECIFIC                          │
│  SubCard  NavBar  PostForm  LiveCounter     │
│  StatCard  Avatar                           │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  COMPOSED PATTERNS                          │
│  SubCardList  FormSidebar  NavLayout        │
└─────────────────────────────────────────────┘
```

### Naming conventions

- **Components:** PascalCase, no slashes, no prefixes. `SubCard`, `StatusBadge`, `Button`.
- **Variants:** Use Figma component properties, not slash naming. `StatusBadge` has property `Status = Open | Claimed` — not `StatusBadge/Open` and `StatusBadge/Claimed`.
- **Variables:** Lowercase with slashes for grouping. `bg/primary`, `text/brand`, `spacing/16`.
- **Text styles:** Category/Size format. `Display/XL`, `Body/M`, `Label/S`.

### Documentation within the file

On your `Foundations` page, create visual documentation frames:

1. **Color ramps** — lay out all three ramps (brand, blue, gray) as swatch rows with hex values labeled. Add notes on which swatches are anchors.
2. **Token mapping table** — a visual frame showing each semantic token, its Dark value, its Light value, and where it's used.
3. **Type scale** — all text styles rendered in a stack so the scale relationships are visible.
4. **Spacing scale** — visual blocks at each spacing increment.
5. **Component inventory** — a frame listing every component with its properties and intended usage.

This doubles as the onboarding document for your co-founder and for any future contributors.

---

## 11. Testing & QA

### Mode switching test

1. Draw a rectangle on the Playground page.
2. Apply `bg/primary` as its fill.
3. Add a text layer on top with `text/primary` as its fill.
4. Select the parent frame → in the right panel under the layer section → switch variable mode from **Dark** to **Light**.
5. Both should update instantly. If they do, your wiring is correct.

### Component spot-check

For each component:

1. Place an instance on the Playground page.
2. Toggle between Dark and Light modes.
3. Confirm: all fills update, no hardcoded hex values remain, text is readable against its background in both modes.
4. Test every variant: switch the component properties (Status, Size, Type) and verify all states look correct.

### Contrast verification

Check WCAG AA compliance (4.5:1 for body text, 3:1 for large text) for these critical pairings:

| Pairing | Target ratio | Check |
|---------|-------------|-------|
| `text/primary` on `bg/primary` (dark) | White on `#080E0B` | ✅ ~19:1 |
| `text/primary` on `bg/primary` (light) | `#080E0B` on white | ✅ ~19:1 |
| `text/brand` on `bg/primary` (dark) | `#1DB967` on `#080E0B` | Check ≥ 4.5:1 |
| `text/on-brand` on `bg/brand` | `#080E0B` on `#1DB967` | Check ≥ 4.5:1 |
| `text/secondary` on `bg/primary` (dark) | `gray/300` on `gray/950` | Check ≥ 4.5:1 |
| `text/tertiary` on `bg/primary` (dark) | `gray/400` on `gray/950` | Check ≥ 3:1 (large text only) |

Use the **Stark** Figma plugin or WebAIM's contrast checker to verify.

### Gradient check

Apply a manual gradient fill to a test frame: first stop = `blue/400`, second stop = `brand/500`. Compare it against the "SUB" wordmark effect in the brand spec. They should match.

### Completeness audit

Before moving to production design work, confirm:

- [ ] All 12 shades filled for brand, blue, and gray (no empty variable slots)
- [ ] Green tint visible in gray ramp at every shade (compare against a pure neutral gray)
- [ ] All semantic tokens reference primitives (no hardcoded hex values in the Tokens collection)
- [ ] Both Dark and Light modes resolve correctly on every token
- [ ] Every forked component uses only semantic tokens (no primitives applied to layers, no hardcoded colors)
- [ ] Spacing and radius variables applied to all Auto Layout frames
- [ ] Text styles created for the full type scale
- [ ] Code Syntax set on all token variables
- [ ] Primitives hidden from publishing
- [ ] Library published and consumable in working files

---

## 12. Handoff to Code

### CSS variable export

When your Figma variables are finalized, the PWA codebase should consume them as CSS custom properties. The mapping:

```css
/* CourtPlay Design Tokens — Dark mode (default) */
:root {
  /* Primitives (referenced by tokens) */
  --color-brand-500: #1DB967;
  --color-brand-600: #16944F;
  --color-brand-800: #0A5C35;
  --color-blue-400:  #60A5FA;
  --color-blue-600:  #2563EB;
  --color-blue-900:  #0F2D6B;
  --color-gray-50:   #F0F5F2;
  --color-gray-100:  #DCE5DF;
  --color-gray-200:  #B8C7BD;
  --color-gray-300:  #8FA399;
  --color-gray-400:  #647A6E;
  --color-gray-500:  #465A4E;
  --color-gray-800:  #1E2E24;
  --color-gray-900:  #0E1812;
  --color-gray-950:  #080E0B;

  /* Semantic tokens (what components consume) */
  --bg-primary:       var(--color-gray-950);
  --bg-secondary:     var(--color-gray-900);
  --bg-tertiary:      var(--color-gray-800);
  --bg-brand:         var(--color-brand-500);
  --bg-brand-subtle:  var(--color-brand-800);

  --text-primary:     #FFFFFF;
  --text-secondary:   var(--color-gray-300);
  --text-tertiary:    var(--color-gray-400);
  --text-brand:       var(--color-brand-500);
  --text-on-brand:    var(--color-gray-950);

  --border-primary:   var(--color-gray-800);
  --border-secondary: var(--color-gray-900);
  --border-brand:     var(--color-brand-500);

  --status-open:      var(--color-brand-500);
  --status-open-bg:   var(--color-brand-800);
  --status-claimed:   var(--color-gray-500);
  --status-claimed-bg: var(--color-gray-800);

  --accent-blue:      var(--color-blue-400);
  --accent-blue-subtle: var(--color-blue-900);

  /* Spacing */
  --space-2: 2px;
  --space-4: 4px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-32: 32px;
  --space-48: 48px;
  --space-64: 64px;

  /* Radius */
  --radius-none: 0;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-full: 999px;
}

/* Light mode override */
[data-theme="light"] {
  --bg-primary:       #FFFFFF;
  --bg-secondary:     var(--color-gray-50);
  --bg-tertiary:      var(--color-gray-100);
  --bg-brand-subtle:  var(--color-brand-25);

  --text-primary:     var(--color-gray-950);
  --text-secondary:   var(--color-gray-500);
  --text-brand:       var(--color-brand-600);
  --text-on-brand:    #FFFFFF;

  --border-primary:   var(--color-gray-200);
  --border-secondary: var(--color-gray-100);

  --status-open-bg:   var(--color-brand-25);
  --status-claimed-bg: var(--color-gray-100);

  --accent-blue:      var(--color-blue-600);
  --accent-blue-subtle: var(--color-blue-25);
}
```

### Token export tools

- **Tokens Studio for Figma** plugin can export variables as JSON design tokens in the W3C Design Tokens format, which can then be consumed by Style Dictionary to generate CSS, Tailwind config, Swift, or Kotlin outputs.
- For a simpler V1 workflow: manually maintain the CSS file above and keep it in sync with Figma changes. At CourtPlay's current scale (< 30 tokens), the overhead of a full token pipeline isn't justified yet.

### Dev Mode usage

When engineers inspect components in Figma's Dev Mode:

1. They'll see semantic token names on every layer (e.g., `bg/primary`, `text/brand`) — not raw hex values.
2. If Code Syntax is set (see Section 7), the CSS property name appears directly (e.g., `var(--bg-primary)`).
3. Spacing and radius show as variable references too.

This means the engineer never has to guess which CSS variable to use — Figma tells them.

---

## Quick-Start Checklist

For the person who wants the shortest path to a working system:

1. [ ] Create the Figma file and page structure
2. [ ] Generate ramps in Huetone (brand, blue, gray)
3. [ ] Create `_Primitives` collection with all three ramps + base colors
4. [ ] Create `Tokens` collection with Dark/Light modes and ~25 semantic tokens
5. [ ] Add spacing and radius variables
6. [ ] Create text styles for the type scale
7. [ ] Set scoping on all variables
8. [ ] Hide primitives from publishing
9. [ ] Fork 6–8 base components from Untitled UI, rewire to tokens
10. [ ] Build SubCard, StatusBadge, NavBar, PostForm from scratch
11. [ ] Test mode switching on every component
12. [ ] Check contrast on critical pairings
13. [ ] Set Code Syntax on token variables
14. [ ] Publish the library
15. [ ] Start designing screens in a working file that consumes the library
