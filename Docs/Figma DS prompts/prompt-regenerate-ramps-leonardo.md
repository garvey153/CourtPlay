# Regenerate CourtPlay Color Ramps with Leonardo + Update Figma

## Objective

Install Adobe's Leonardo contrast-colors package. Use it to regenerate the CourtPlay `brand` (green) and `gray` (green-tinted neutral) color ramps with the following adjustments:

1. **Warmer, deeper green** — increase the green chroma/saturation, particularly in the mid and dark range. The current palette feels too cool and desaturated. Shift the hue slightly toward a richer, more lush green (think deep forest, not gray-green).
2. **Greater contrast between dark shades** — the current 950, 900, and 800 values are too close together, making dark surfaces feel muddy and indistinct. Increase the lightness separation between these steps so that a surface using 800 is clearly distinguishable from one using 900, and 900 is clearly distinguishable from 950.

The `blue`, `error`, `warning`, and `base` ramps stay unchanged.

## Step 1: Install Leonardo

```bash
npm install @adobe/leonardo-contrast-colors
```

## Step 2: Generate new ramps

Use Leonardo's `Color`, `BackgroundColor`, and `Theme` classes to generate the ramps.

### Brand (green) ramp

**Current anchor:** `#1DB967` (brand/500)
**Current deep anchor:** `#0A5C35` (brand/800)

Adjustments:
- Increase chroma across the ramp — especially from 400 through 800. The greens should feel vivid and alive, not washed out.
- Push the hue slightly warmer (toward yellow-green, roughly 145–155° in LCH, rather than blue-green). Not dramatically — just enough to feel lush rather than clinical.
- Keep brand/500 close to `#1DB967` (this is the brand anchor and shouldn't shift dramatically), but allow it to warm slightly if the ramp benefits.
- Ensure brand/25 through brand/100 are very light, clearly tinted greens — not near-white.

Generate 12 steps: 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950.

### Gray (green-tinted neutral) ramp

**Current anchors:** `#080E0B` (gray/950 / Ink), `#F0F5F2` (gray/50 / Paper)

Adjustments:
- Increase the green tint throughout — every shade should have a visible warm green undertone, not just a hint. Compare against a pure neutral gray at each step; the green should be noticeable.
- **Critical: increase lightness separation at the dark end.** The current gray/950, gray/900, and gray/800 are almost indistinguishable. Target these approximate lightness values (in LCH Lightness, 0–100 scale):
  - gray/950: ~5 (near black, deep ink)
  - gray/900: ~12 (clearly lighter than 950 — card surfaces)
  - gray/800: ~20 (clearly lighter than 900 — elevated surfaces, hover states)
  - gray/700: ~28
- The light end (25, 50, 100) should be warm off-whites with obvious green warmth — not pure gray.
- gray/50 should stay close to `#F0F5F2` (Paper) — this is a known brand value.

Generate 12 steps: 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950.

### Leonardo configuration guidance

```javascript
const { Color, BackgroundColor, Theme } = require('@adobe/leonardo-contrast-colors');

// For the brand ramp, create a Color with key colors that steer warmth:
let brandGreen = new Color({
  name: 'brand',
  colorKeys: ['#1DB967'], // primary anchor — allow Leonardo to interpolate
  colorSpace: 'LCH',
  ratios: [...] // or use lightness stops
});

// For the gray ramp, use a BackgroundColor since it also serves as the theme background:
let gray = new BackgroundColor({
  name: 'gray',
  colorKeys: ['#0A1F12', '#F0F5F2'], // dark green-ink to warm paper
  colorSpace: 'LCH',
  ratios: [...] // 12 target ratios against the background
});
```

You may need to experiment with:
- Adding intermediate key colors to steer the hue (e.g., a warmer mid-green key color around the 400–600 range)
- Using the `lightness` approach on Theme rather than `ratios` if that gives more direct control over step separation
- Adjusting key color hue to ~148–155° in LCH for warmth

The exact API approach is up to you — the goal is the visual result described above, not a specific API call pattern.

## Step 3: Generate proof HTML

Create an HTML file called `courtplay-ramp-proof.html` that displays:

### Section 1: Full ramp comparison

Side-by-side display of OLD vs NEW ramps for both brand and gray:
- Each ramp as a horizontal row of 12 swatches (80x80px)
- Labeled with step number and hex value
- Old ramp on top, new ramp below
- Clear "OLD" and "NEW" labels

### Section 2: Dark surface contrast proof (critical)

This is the most important section. Show realistic UI surface simulations using the NEW gray ramp:

**Panel A — Layered surfaces:**
A frame simulating three nested dark surfaces, like the actual CourtPlay UI:
- Outermost background: gray/950 (the page)
- Middle card: gray/900 (card surface), with visible edges against 950
- Inner element: gray/800 (elevated element or hover state), visible against 900

Each surface should be at least 200x100px so the contrast is evaluable. Label each with its step number and hex value.

**Panel B — Side-by-side pairs:**
- 800 on 900: a rectangle of gray/800 sitting on a gray/900 background. Should be CLEARLY distinguishable.
- 900 on 950: a rectangle of gray/900 sitting on a gray/950 background. Should be CLEARLY distinguishable.
- 800 on 950: a rectangle of gray/800 sitting on a gray/950 background.
- Show the contrast ratio between each pair.

**Panel C — Text on dark surfaces:**
- White (#FFFFFF) text on gray/950, gray/900, and gray/800 — show "Sub request" in 16px
- brand/500 text on gray/950 — show "Open" in 14px
- gray/400 text on gray/950 — show "20m ago" in 13px
- Show WCAG contrast ratios next to each

### Section 3: Brand green vibrancy proof

- A primary button: brand/500 background with gray/950 text ("Post sub need")
- StatusBadge simulation: small pill with brand/800 background and brand/500 text ("Open")
- The "SUB" gradient: a large text sample with a gradient from blue/400 to the new brand/500

### Styling

- Use dark background (#080E0B or the new gray/950) for the overall page
- Use DM Sans and Outfit fonts (Google Fonts)
- Clean, minimal layout — this is a proof sheet, not a marketing page
- Include a section header for each section in a small mono label style

Save to `courtplay-ramp-proof.html`.

## Step 4: Wait for approval

Present the HTML proof file. Do NOT proceed to Step 5 until I explicitly approve the new colors.

If I request adjustments (e.g., "800 and 900 are still too close" or "the green is too yellow"), regenerate with adjusted parameters and produce a new proof.

## Step 5: Update Figma primitives (only after approval)

Once I approve:

1. Read the existing `_Primitives` collection from the CourtPlay Design System Figma file via MCP.
2. Update ONLY the `brand/*` and `gray/*` variables with the new hex values. Do not touch `blue`, `error`, `warning`, or `base`.
3. Read back the updated variables and confirm all 24 values (12 brand + 12 gray) match the approved proof.
4. Log a before/after comparison showing old hex → new hex for each variable.

## Important notes

- Do NOT change the blue ramp. It stays as-is.
- Do NOT change error or warning ramps.
- The brand/500 anchor can shift slightly for ramp harmony, but should remain recognizably "CourtPlay green" — not lime, not teal, not olive.
- The gray ramp MUST maintain a green undertone at every step. If any shade reads as pure neutral gray or blue-gray, adjust.
- After updating Figma, the semantic tokens in the `Tokens` collection will automatically reflect the new primitives since they're aliases. No token changes needed.
