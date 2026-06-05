# Step 4: Set Up CourtPlay `Tokens` Variable Collection

## What to do

In the CourtPlay Design System Figma file, create a variable collection called `Tokens` with TWO modes: `Dark` (default/first) and `Light`. Populate it with semantic color variables that reference the `_Primitives` collection created in Step 3.

CourtPlay is a dark-first product. Dark mode is the primary design surface.

## How references work

Every value in the `Tokens` collection is a **reference to a primitive variable** — not a raw hex value. When setting a token's value, alias it to the corresponding `_Primitives` variable ID. Read the `_Primitives` collection first to get the variable IDs for each primitive.

## Token definitions

All tokens are type COLOR. Each token has two values — one for Dark mode, one for Light mode. The "→" indicates which primitive variable to reference.

### Background tokens

| Token name | Dark mode → | Light mode → |
|------------|-------------|--------------|
| bg/primary | gray/950 | base/white |
| bg/secondary | gray/900 | gray/50 |
| bg/tertiary | gray/800 | gray/100 |
| bg/brand | brand/500 | brand/500 |
| bg/brand-subtle | brand/800 | brand/25 |
| bg/brand-hover | brand/600 | brand/600 |
| bg/error | error/500 | error/500 |
| bg/error-subtle | error/900 | error/25 |
| bg/warning | warning/500 | warning/500 |
| bg/warning-subtle | warning/900 | warning/25 |

### Text tokens

| Token name | Dark mode → | Light mode → |
|------------|-------------|--------------|
| text/primary | base/white | gray/950 |
| text/secondary | gray/300 | gray/500 |
| text/tertiary | gray/400 | gray/400 |
| text/brand | brand/500 | brand/600 |
| text/on-brand | gray/950 | base/white |
| text/on-dark | base/white | base/white |
| text/error | error/500 | error/600 |
| text/warning | warning/500 | warning/600 |

### Border tokens

| Token name | Dark mode → | Light mode → |
|------------|-------------|--------------|
| border/primary | gray/800 | gray/200 |
| border/secondary | gray/900 | gray/100 |
| border/brand | brand/500 | brand/500 |
| border/error | error/500 | error/500 |

### Status tokens (CourtPlay-specific)

| Token name | Dark mode → | Light mode → |
|------------|-------------|--------------|
| status/open | brand/500 | brand/600 |
| status/open-bg | brand/800 | brand/25 |
| status/claimed | gray/500 | gray/400 |
| status/claimed-bg | gray/800 | gray/100 |
| status/error | error/500 | error/600 |
| status/error-bg | error/900 | error/25 |

### Accent tokens

| Token name | Dark mode → | Light mode → |
|------------|-------------|--------------|
| accent/blue | blue/400 | blue/600 |
| accent/blue-subtle | blue/900 | blue/25 |

### Icon tokens

| Token name | Dark mode → | Light mode → |
|------------|-------------|--------------|
| icon/primary | base/white | gray/950 |
| icon/secondary | gray/400 | gray/400 |
| icon/brand | brand/500 | brand/600 |

## Rules

- Read the `_Primitives` collection first to get all variable IDs. You need these to create alias references.
- The `Tokens` collection must have exactly TWO modes: `Dark` first, `Light` second.
- Every value must be an alias to a primitive — no raw hex values in this collection.
- If the collection or any tokens already exist, update them — don't duplicate.
- After creation, read back and log a summary: total token count and count per group (bg, text, border, status, accent, icon).
- Total expected: ~35 tokens.
