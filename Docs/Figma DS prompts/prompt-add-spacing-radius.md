# Add Spacing & Radius Variables to `_Primitives`

## What to do

In the CourtPlay Design System Figma file, add spacing and radius NUMBER variables to the existing `_Primitives` variable collection. These may have failed to create on a previous attempt — check if any already exist before creating, and don't duplicate.

## Important

- These are **NUMBER** variables, not COLOR.
- Add them to the **existing** `_Primitives` collection. Do NOT create a new collection.
- Use the existing single mode in `_Primitives`.

## Variables to create

### `spacing` group

| Name | Value |
|------|-------|
| spacing/2 | 2 |
| spacing/4 | 4 |
| spacing/8 | 8 |
| spacing/12 | 12 |
| spacing/16 | 16 |
| spacing/20 | 20 |
| spacing/24 | 24 |
| spacing/32 | 32 |
| spacing/48 | 48 |
| spacing/64 | 64 |

### `radius` group

| Name | Value |
|------|-------|
| radius/none | 0 |
| radius/sm | 2 |
| radius/md | 4 |
| radius/lg | 8 |
| radius/full | 999 |

## Troubleshooting

If the MCP tool rejects NUMBER type variables:
- Check whether the API expects `FLOAT` instead of `NUMBER` as the resolved type
- Try creating one variable first as a test before batching all 15

If the variables were created in a separate collection on the previous attempt:
- Delete that separate collection
- Recreate them inside `_Primitives`

## Verification

After creation, read back the `_Primitives` collection and confirm:
- 15 new number variables exist (10 spacing + 5 radius)
- They are in the `_Primitives` collection alongside the existing color variables
- Values are correct

Log the full variable list showing all number variables with their names and values.
