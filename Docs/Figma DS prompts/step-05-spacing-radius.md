# Step 5: Add Spacing & Radius Variables to `_Primitives`

## What to do

In the CourtPlay Design System Figma file, add spacing and radius variables to the existing `_Primitives` collection. These are NUMBER type variables (not color).

## Spacing variables

Create a `spacing` group inside `_Primitives`. All type FLOAT/NUMBER.

| Name | Value | Usage context |
|------|-------|---------------|
| spacing/2 | 2 | Hairline gaps |
| spacing/4 | 4 | Tight inner padding |
| spacing/8 | 8 | Default inner padding, icon gaps |
| spacing/12 | 12 | Compact component padding |
| spacing/16 | 16 | Standard component padding |
| spacing/20 | 20 | Medium component padding |
| spacing/24 | 24 | Card internal padding |
| spacing/32 | 32 | Section separation |
| spacing/48 | 48 | Large section separation |
| spacing/64 | 64 | Page-level spacing |

## Radius variables

Create a `radius` group inside `_Primitives`. All type FLOAT/NUMBER.

| Name | Value | Usage context |
|------|-------|---------------|
| radius/none | 0 | Square elements |
| radius/sm | 2 | Badges, inputs, subtle rounding |
| radius/md | 4 | Cards, buttons |
| radius/lg | 8 | Modals, overlays |
| radius/full | 999 | Pill shapes, avatars |

## Rules

- Add to the EXISTING `_Primitives` collection — do not create a new collection.
- Use the existing single mode in `_Primitives`.
- These are NUMBER variables, not COLOR.
- Set scoping: spacing variables should be scoped to `GAP` and `PADDING` properties. Radius variables should be scoped to `CORNER_RADIUS`.
- If any already exist, update — don't duplicate.
- After creation, read back and confirm: 10 spacing variables + 5 radius variables = 15 new variables added.
