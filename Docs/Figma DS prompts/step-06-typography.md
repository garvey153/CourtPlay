# Step 6: Create Typography Text Styles

## What to do

In the CourtPlay Design System Figma file, create text styles for the CourtPlay type scale. These are Figma **text styles** (not variables — Figma's typography variable support is still limited).

## Font families

Ensure these Google Fonts are available in the file:

- **Outfit** — display and heading text (weights: 300, 400, 500, 600, 700, 800, 900)
- **DM Sans** — body and UI text (weights: 400, 500, 600, 700)
- **JetBrains Mono** — monospace/technical text (weights: 400, 500, 600)

## Text style definitions

Create each text style with the exact properties below. Style names use `/` for grouping.

### Display styles (Outfit)

| Style name | Font | Weight | Size (px) | Line height | Letter spacing |
|------------|------|--------|-----------|-------------|----------------|
| Display/XL | Outfit | Black (900) | 72 | 92% | 0.04em |
| Display/L | Outfit | ExtraBold (800) | 48 | 100% | 0.02em |
| Display/M | Outfit | Bold (700) | 32 | 110% | 0.01em |
| Display/S | Outfit | Bold (700) | 24 | 120% | 0 |

### Heading styles

| Style name | Font | Weight | Size (px) | Line height | Letter spacing |
|------------|------|--------|-----------|-------------|----------------|
| Heading/L | Outfit | SemiBold (600) | 18 | 130% | -0.01em |
| Heading/M | DM Sans | Bold (700) | 16 | 140% | 0 |

### Body styles (DM Sans)

| Style name | Font | Weight | Size (px) | Line height | Letter spacing |
|------------|------|--------|-----------|-------------|----------------|
| Body/M | DM Sans | Regular (400) | 14 | 155% | 0 |
| Body/S | DM Sans | Regular (400) | 13 | 150% | 0 |

### Label styles (DM Sans, uppercase)

| Style name | Font | Weight | Size (px) | Line height | Letter spacing | Transform |
|------------|------|--------|-----------|-------------|----------------|-----------|
| Label/M | DM Sans | Bold (700) | 12 | 130% | 0.12em | UPPERCASE |
| Label/S | DM Sans | SemiBold (600) | 10 | 130% | 0.2em | UPPERCASE |

### Monospace style (JetBrains Mono)

| Style name | Font | Weight | Size (px) | Line height | Letter spacing |
|------------|------|--------|-----------|-------------|----------------|
| Mono/S | JetBrains Mono | Medium (500) | 11 | 140% | 0.02em |

## Rules

- Create these as Figma TEXT STYLES, not variables.
- Do NOT bake color into text styles. Color is applied separately via the `text/*` semantic tokens. Text styles should only define font family, weight, size, line height, letter spacing, and text transform.
- If styles already exist with the same names, update them.
- Total: 11 text styles.
- After creation, read back the styles and log a summary showing all 11 style names.

## Visual documentation

On the `Foundations` page of the file, create a frame (1200px wide, auto-height) that displays the full type scale:

- Stack all 11 styles vertically with 24px gap
- Each row shows: the style name as a small label (Label/S, gray/400), then a sample text line rendered in that style
- Sample text for each: "Find your sub. Fill the court."
- Use `text/primary` color (white for dark background)
- Set the frame background to `bg/primary` (dark)
