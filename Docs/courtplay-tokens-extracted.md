# CourtPlay Design Tokens — extracted from Figma

Source: **CourtPlay Design System** file (`vTyLvrMvNSBEHrDdGV9eip`), pulled 2026-06-06 via Figma plugin MCP.
Two collections: `_Primitives` (raw ramps, single mode) and `Tokens` (semantic, Dark + Light modes).
**App ships dark-only** — use the Dark column when mapping to `theme.css`.

## _Primitives (raw values)

### brand (green)
| step | hex | step | hex |
|------|-----|------|-----|
| 25 | #eef9f1 | 500 | #1ab363 |
| 50 | #e1f4e6 | 600 | #118c4a |
| 100 | #cdedd5 | 700 | #00682f |
| 200 | #b1e3be | 800 | #00400b |
| 300 | #8fd7a4 | 900 | #002800 |
| 400 | #65c988 | 950 | #001a00 |

### gray (green-tinted, dark-optimized)
| step | hex | step | hex |
|------|-----|------|-----|
| 25 | #f3f7f5 | 500 | #617367 |
| 50 | #d6e1da | 600 | #4d5f53 |
| 100 | #bbcbc1 | 700 | #394c3f |
| 200 | #a2b5aa | 800 | #26382c |
| 300 | #8ca095 | 900 | #17261c |
| 400 | #75897d | 950 | #08180e |

### blue (accent / "Regular play" / info)
25 #eff6ff · 50 #dbeafe · 100 #bfdbfe · 200 #93c5fd · 300 #6cb5fc · 400 #60a5fa · 500 #3b82f6 · 600 #2563eb · 700 #1d4ed8 · 800 #1e40af · 900 #0f2d6b · 950 #0a1e4a

### error (red)
25 #fffbfa · 50 #fef3f2 · 100 #fee4e2 · 200 #fecdca · 300 #fda29b · 400 #f97066 · 500 #f04438 · 600 #d92d20 · 700 #b42318 · 800 #912018 · 900 #7a271a · 950 #55160c

### warning (amber)
25 #fffcf5 · 50 #fffaeb · 100 #fef0c7 · 200 #fedf89 · 300 #fec84b · 400 #fdb022 · 500 #f79009 · 600 #dc6803 · 700 #b54708 · 800 #93370d · 900 #7a2e0e · 950 #4e1d09

### base
white #ffffff · black #000000

### spacing (px)
2, 4, 8, 12, 16, 20, 24, 32, 48, 64

### radius (px)
none 0 · "Feed card" 4 · sm 8 · md 10 · lg 12 · full 999

## Tokens (semantic) — Dark mode → primitive alias

### Backgrounds
- bg/primary → gray/950 (#08180e)
- bg/secondary → gray/900 (#17261c)
- bg/tertiary → gray/800 (#26382c)
- bg/brand → brand/500 · bg/brand-hover → brand/600 · bg/brand-subtle → brand/800
- bg/error → error/500 · bg/error-subtle → error/900
- bg/warning → warning/500 · bg/warning-subtle → warning/900
- bg/menu_selected → gray/800
- bg/calendar_selected → gray/600 · bg/calendar_today's date → blue/600 (hover blue/700, disabled blue/800)

### Text
- text/primary → base/white · text/secondary → gray/200 · text/tertiary → gray/400
- text/brand → brand/500 · text/on-brand → gray/950 · text/on-dark → base/white
- text/error → error/500 · text/warning → warning/500

### Borders
- border/primary → gray/800 · border/secondary → gray/900 · border/tertiary → gray/600
- border/brand → brand/500 · border/error → error/500

### Status (claim/post lifecycle)
- status/open → brand/500 · status/open-bg → brand/800
- status/claimed → gray/400 · status/claimed-bg → gray/800
- status/error → error/500 · status/error-bg → error/900 · status/error_badge → error/400
- status/warning-bg → warning/500
- status/Regular play → blue/500
- status/Menu_checked → gray/900

### Accent / Icons
- accent/blue → blue/400 · accent/blue-subtle → blue/900
- icon/primary → base/white · icon/secondary → gray/400 · icon/brand → brand/500

## Notes
- A Light mode exists in Figma but the app ships **dark-only**.
- CourtPlay-specific tokens beyond Untitled UI's defaults: `status/*` (claim lifecycle), `status/Regular play`, calendar tokens, `accent/blue`, `radius/Feed card`.
