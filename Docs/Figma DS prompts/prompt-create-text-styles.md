# Create CourtPlay Text Styles

## What to do

In the CourtPlay Design System Figma file, create 11 text styles. Check if any already exist before creating — don't duplicate.

## Font families

- **Outfit** — display and heading text
- **DM Sans** — body and UI text
- **JetBrains Mono** — monospace/technical text

These are Google Fonts. They need to be available in the file.

## Text styles to create

### Display styles

| Style name | Font | Weight | Size | Line height | Letter spacing | Transform |
|------------|------|--------|------|-------------|----------------|-----------|
| Display/XL | Outfit | Black (900) | 72px | 92% | 0.04em | None |
| Display/L | Outfit | ExtraBold (800) | 48px | 100% | 0.02em | None |
| Display/M | Outfit | Bold (700) | 32px | 110% | 0.01em | None |
| Display/S | Outfit | Bold (700) | 24px | 120% | 0em | None |

### Heading styles

| Style name | Font | Weight | Size | Line height | Letter spacing | Transform |
|------------|------|--------|------|-------------|----------------|-----------|
| Heading/L | Outfit | SemiBold (600) | 18px | 130% | -0.01em | None |
| Heading/M | DM Sans | Bold (700) | 16px | 140% | 0em | None |

### Body styles

| Style name | Font | Weight | Size | Line height | Letter spacing | Transform |
|------------|------|--------|------|-------------|----------------|-----------|
| Body/M | DM Sans | Regular (400) | 14px | 155% | 0em | None |
| Body/S | DM Sans | Regular (400) | 13px | 150% | 0em | None |

### Label styles

| Style name | Font | Weight | Size | Line height | Letter spacing | Transform |
|------------|------|--------|------|-------------|----------------|-----------|
| Label/M | DM Sans | Bold (700) | 12px | 130% | 0.12em | UPPERCASE |
| Label/S | DM Sans | SemiBold (600) | 10px | 130% | 0.2em | UPPERCASE |

### Monospace style

| Style name | Font | Weight | Size | Line height | Letter spacing | Transform |
|------------|------|--------|------|-------------|----------------|-----------|
| Mono/S | JetBrains Mono | Medium (500) | 11px | 140% | 0.02em | None |

## Important

- These are Figma **text styles**, not variables.
- Do NOT include color in the styles. Color is applied separately via semantic tokens.
- The `/` in style names creates grouping (e.g., `Display/XL` appears under a "Display" group).
- If the MCP tools cannot create text styles directly, create text layers on the `Foundations` page with the correct properties and instruct the user to convert them to styles manually.

## Verification

After creation, read back all text styles in the file and confirm all 11 exist. Log each style name with its font, weight, and size.
