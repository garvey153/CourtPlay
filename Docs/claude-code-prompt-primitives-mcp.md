# Set Up CourtPlay `_Primitives` Variable Collection

## What to do

In the CourtPlay Design System Figma file, create a variable collection called `_Primitives` with a single mode. Populate it with 62 color variables across 6 groups. Use the Figma MCP tools to create the collection and variables.

## Variable definitions

All variables are type COLOR. The `/` in each name creates the group automatically.

### brand (CourtPlay's primary green)

| Name | Hex |
|------|-----|
| brand/25 | #ECFDF3 |
| brand/50 | #D1FADF |
| brand/100 | #A6F4C5 |
| brand/200 | #6CE9A6 |
| brand/300 | #3FD88A |
| brand/400 | #22C66E |
| brand/500 | #1DB967 |
| brand/600 | #16944F |
| brand/700 | #0F753E |
| brand/800 | #0A5C35 |
| brand/900 | #074D2B |
| brand/950 | #053E22 |

### blue (secondary accent)

| Name | Hex |
|------|-----|
| blue/25 | #EFF6FF |
| blue/50 | #DBEAFE |
| blue/100 | #BFDBFE |
| blue/200 | #93C5FD |
| blue/300 | #6CB5FC |
| blue/400 | #60A5FA |
| blue/500 | #3B82F6 |
| blue/600 | #2563EB |
| blue/700 | #1D4ED8 |
| blue/800 | #1E40AF |
| blue/900 | #0F2D6B |
| blue/950 | #0A1E4A |

### gray (green-tinted neutrals — NOT pure grays)

| Name | Hex |
|------|-----|
| gray/25 | #F7FAF8 |
| gray/50 | #F0F5F2 |
| gray/100 | #DCE5DF |
| gray/200 | #B8C7BD |
| gray/300 | #8FA399 |
| gray/400 | #647A6E |
| gray/500 | #465A4E |
| gray/600 | #344539 |
| gray/700 | #243530 |
| gray/800 | #1E2E24 |
| gray/900 | #0E1812 |
| gray/950 | #080E0B |

### base

| Name | Hex |
|------|-----|
| base/white | #FFFFFF |
| base/black | #000000 |

### error

| Name | Hex |
|------|-----|
| error/25 | #FFFBFA |
| error/50 | #FEF3F2 |
| error/100 | #FEE4E2 |
| error/200 | #FECDCA |
| error/300 | #FDA29B |
| error/400 | #F97066 |
| error/500 | #F04438 |
| error/600 | #D92D20 |
| error/700 | #B42318 |
| error/800 | #912018 |
| error/900 | #7A271A |
| error/950 | #55160C |

### warning

| Name | Hex |
|------|-----|
| warning/25 | #FFFCF5 |
| warning/50 | #FFFAEB |
| warning/100 | #FEF0C7 |
| warning/200 | #FEDF89 |
| warning/300 | #FEC84B |
| warning/400 | #FDB022 |
| warning/500 | #F79009 |
| warning/600 | #DC6803 |
| warning/700 | #B54708 |
| warning/800 | #93370D |
| warning/900 | #7A2E0E |
| warning/950 | #4E1D09 |

## Rules

- The collection has ONE mode only (the default). No Dark/Light — that's for the Tokens collection later.
- Convert hex to Figma's RGBA format (0–1 floats) before setting values.
- If any variables or the collection already exist, update them — don't duplicate.
- After creation, read back the variables to confirm all 62 exist and log a summary count per group.
