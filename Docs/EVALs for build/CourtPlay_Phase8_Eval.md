# CourtPlay — Phase 8 Eval: Discount, Urgency & Post Lifecycle

## How to use this eval

Run this prompt in Claude Code after Phase 8 is complete. Phase 8 ties together several systems built in earlier phases — the discount mechanic triggers Phase 7 notifications, the time pressure label enhances Phase 3 cards, and the cancellation flow interacts with Phase 4 claims. This eval tests both the new features and their integration with everything built so far.

The eval has six passes:

1. **Code quality audit** — Review all Phase 8 code for correctness, security, and best practices.
2. **Discount mechanic tests** — Price reduction, original_cost tracking, visual treatment, notification triggers.
3. **Time pressure label tests** — Threshold math, color transitions, edge cases.
4. **Cancellation flow tests** — Soft delete, claimer notifications, Venmo refund reminder, series handling.
5. **Integration tests** — Cross-phase interactions between discount, notifications, feed, and claims.
6. **Manual verification** — Visual/UX checklist in a 390px mobile viewport.

Work through each pass sequentially. Fix issues before proceeding.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phases 3–7 evals pass completely.
4. Supabase database has the full schema applied, including:
   - `posts` table with `cost`, `original_cost`, `status`, `deleted_at`, `deleted_by`, `series_id` columns
   - `post_views` table (for price drop notification recipients)
   - `notify_me` table (for spot-reopened notification recipients)
   - `notifications` table (for deduplication checks and logging)
   - `claims` table with all status values
   - Phase 7 `send-notification` Edge Function deployed and working
   - Phase 7 `48h-unfilled-nudge` Edge Function deployed
5. Test data:

   | Entity | Details |
   |---|---|
   | **User A** (poster) | Has 4 active posts. Notifications configured. |
   | **User B** (claimer) | Has pending claim on Post P1. Has approved claim on Post P2. Push + email enabled. |
   | **User C** (viewer) | Has viewed Post P1 (row in post_views). Has a notify_me entry on Post P3. Push + email enabled. |
   | **User D** (second claimer) | Has pending claim on Post P2. Push + email enabled. |
   | **Post P1** | By User A. Active sub_need. Cost = $40. Game = tomorrow, 9:00 AM. 1 pending claim (User B). |
   | **Post P2** | By User A. Active sub_need. Cost = $30. Game = day after tomorrow. spots_total = 2. 1 approved claim (User B), 1 pending claim (User D). |
   | **Post P3** | By User A. Active sub_need. Cost = $25. All spots filled (spots_available = 0). User C has notify_me. |
   | **Post P4** | By User A. Active sub_need. Game = today, 3 hours from now. No claims. (For time pressure red label.) |
   | **Post P5** | By User A. Active sub_need. Game = today, 8 hours from now. (For time pressure amber label.) |
   | **Post P6** | By User A. Active sub_need. Game = today, 14 hours from now. (For time pressure green label.) |
   | **Post P7** | By User A. Active sub_need. Game = 3 days from now. (No time pressure label.) |
   | **Post S1, S2, S3** | By User A. Series posts (shared series_id). S1 game = tomorrow. S2 game = day after. S3 game = 3 days out. S1 has 1 approved claim by User B. S2 and S3 have no claims. |

---

## Pass 1 — Code quality audit

### 1.1 File structure

Phase 8 primarily modifies existing components and adds the cancellation flow. Verify:

- [ ] Discount mechanic lives in the My Activity / My Posts section — not a standalone page.
- [ ] Cancellation flow uses an Untitled UI Modal/Dialog — not `window.confirm()`.
- [ ] Time pressure label is part of the SubCard component (or a subcomponent imported by SubCard).
- [ ] No new files placed in `/src/components/ui/`.

### 1.2 TypeScript quality

- [ ] No `any` types in Phase 8 code.
- [ ] The discount input validates that the new price is a non-negative number and strictly less than the current cost. Type guard or runtime check — not just `type="number"` on the input.
- [ ] `original_cost` is typed as `number | null` — the component handles both states correctly.
- [ ] The time pressure calculation function returns a typed result: e.g., `{ hours: number, color: 'green' | 'amber' | 'red' } | null` (null when > 24h).
- [ ] Cancellation-related types include the soft delete fields: `deleted_at: string | null`, `deleted_by: string | null`.
- [ ] Series ID is typed as `string | null`.

### 1.3 Discount mechanic correctness

- [ ] "Reduce price" button appears ONLY on the poster's own active posts in My Activity > My Posts.
- [ ] "Reduce price" button does NOT appear on expired, deleted, or cancelled posts.
- [ ] The discount input enforces: new price < current cost. A price equal to or greater than current cost is rejected with an inline validation message.
- [ ] The discount allows reducing to $0. No floor is enforced.
- [ ] On save: `posts.cost` updated to the new price. If `original_cost` is null, `original_cost` is set to the old cost. If `original_cost` is already set (second discount), it is NOT updated — it preserves the very first price.
- [ ] The update is atomic — `cost` and `original_cost` are set in a single Supabase `.update()` call, not two separate calls.
- [ ] After discount, the SubCard shows: original price in gray with strikethrough, new price in green.
- [ ] Multiple sequential discounts work: $40 → $30 → $20. `original_cost` stays at $40 throughout.

### 1.4 Discount notification triggers

Per Phase 7 notification matrix:

- [ ] **N5 (cost changed):** All pending and approved claimers notified. Data includes old cost, new cost, and back-out option.
- [ ] **N5 exclusion:** Rejected, unclaimed, and cancelled claimers are NOT notified.
- [ ] **N8 (price drop — prior viewers):** All users with a `post_views` row for this post are notified. Channel is push only.
- [ ] **N8 exclusion:** The poster themselves is NOT included in price drop notifications even if they have a `post_views` row.
- [ ] **N8 exclusion:** Users who already have an active claim (pending/approved) are NOT double-notified via N8 — they already receive N5.
- [ ] **notify_me watchers:** Users with `notify_me` entries also receive a price drop notification (they're watching the post).
- [ ] If the post has no viewers, no claimers, and no watchers: discount succeeds silently with no notifications.

### 1.5 Time pressure label

- [ ] Calculation: `hours_until_game = (game_date + game_time) - now()` — uses both date and time, not just date.
- [ ] Label shown ONLY when `hours_until_game < 24` and `hours_until_game > 0`.
- [ ] Label NOT shown when game has already started (`hours_until_game <= 0`).
- [ ] Label NOT shown on `regular_game` posts (no game_date/game_time).
- [ ] Color thresholds:
  - Green (`--color-primary`): `hours_until_game > 12`
  - Amber (`--color-amber`): `4 < hours_until_game <= 12`
  - Red (`--color-red`): `hours_until_game <= 4`
- [ ] Label text format: "Game in Xh" where X is a whole number (rounded down). Not "Game in 3.7h" or "Game in 3 hours 42 minutes".
- [ ] The label updates without a page refresh (recalculates on each render or on an interval).
- [ ] The label appears on feed cards AND on the post detail page.

### 1.6 Cancellation flow

- [ ] "Cancel" button appears on the poster's own active posts in My Activity > My Posts.
- [ ] Tapping "Cancel" opens a confirmation modal with TWO pieces of copy:
  1. "Cancel this post? All pending and approved claimers will be notified."
  2. "If payment has already been made via Venmo, please coordinate directly with your sub to arrange a refund."
- [ ] On confirm: `posts.status` set to `'deleted'`, `posts.deleted_at` set to `now()`, `posts.deleted_by` set to the poster's user ID.
- [ ] This is a soft delete — the row stays in the database. No `DELETE FROM` statement.
- [ ] After cancellation, the post disappears from the feed (feed query filters `status = 'active'`).
- [ ] After cancellation, the post appears in My Activity > My Posts with a "Cancelled" state — not completely gone.
- [ ] All pending and approved claimers are notified via `send-notification`.
- [ ] Rejected, unclaimed, and cancelled claimers are NOT notified.
- [ ] The cancellation notification includes the Venmo refund reminder text.

### 1.7 Series cancellation

- [ ] When cancelling a series post, the modal shows: "Cancel this date only or all future dates in this series?"
- [ ] "This date only" cancels just the selected post.
- [ ] "All future dates" cancels all posts in the series with `game_date >= today` — but does NOT cancel posts that already have an approved claim.
- [ ] Posts with approved claims in the series are skipped, and the poster is informed: "X dates with approved claims were not cancelled."
- [ ] Each cancelled post in the series notifies its own claimers independently.

### 1.8 Design token compliance

- [ ] Discount display: original cost uses `line-through` text decoration and `--color-text-tertiary` (gray). New cost uses `--color-primary` (green).
- [ ] Time pressure label green: `--color-primary`.
- [ ] Time pressure label amber: `--color-amber`.
- [ ] Time pressure label red: `--color-red`.
- [ ] Cancellation modal uses the token palette — no hardcoded hex colors.
- [ ] "Reduce price" input and button use `--color-primary` for the save action.

### 1.9 Security

- [ ] Only the poster can discount their own post. RLS enforces `auth.uid() = author_id` on update.
- [ ] Only the poster can cancel their own post. Same RLS enforcement.
- [ ] The discount cannot increase the price — server-side validation (not just frontend) ensures `new_cost < current_cost`.
- [ ] Cancellation cannot be triggered by a claimer, a viewer, or an admin through the frontend cancellation flow. (Admin has a separate soft-delete in Phase 10.)

---

## Pass 2 — Discount mechanic tests

Create `/src/__tests__/discount-mechanic.test.ts`.

```
Test: "discount updates cost and sets original_cost on first discount"
  - Post P1: cost = $40, original_cost = null
  - Reduce price to $30
  - Assert: posts.cost = 30
  - Assert: posts.original_cost = 40

Test: "second discount updates cost but preserves original_cost"
  - Post now: cost = $30, original_cost = $40
  - Reduce price to $20
  - Assert: posts.cost = 20
  - Assert: posts.original_cost = 40 (unchanged)

Test: "third discount to $0 works"
  - Reduce price to $0
  - Assert: posts.cost = 0
  - Assert: posts.original_cost = 40 (still the first price)

Test: "discount to equal current cost is rejected"
  - Post cost = $30
  - Attempt to set new price = $30
  - Assert: validation error shown, update NOT executed

Test: "discount to higher than current cost is rejected"
  - Post cost = $30
  - Attempt to set new price = $35
  - Assert: validation error shown, update NOT executed

Test: "discount to negative value is rejected"
  - Attempt to set new price = -5
  - Assert: validation error shown

Test: "discount to non-numeric value is rejected"
  - Attempt to set new price = "abc"
  - Assert: validation error shown

Test: "discount with decimal values works"
  - Post cost = $40
  - Reduce to $29.50
  - Assert: posts.cost = 29.50

Test: "discount atomic update — cost and original_cost set in single call"
  - Mock Supabase .update()
  - Discount from $40 to $30
  - Assert: .update() called exactly once with both cost and original_cost

Test: "Reduce price button shown only on own active posts"
  - Render My Posts as User A
  - Assert: "Reduce price" visible on active posts
  - Assert: "Reduce price" NOT visible on expired posts
  - Assert: "Reduce price" NOT visible when viewing other users' posts

Test: "Reduce price button disabled during save"
  - Tap save with valid discount
  - Assert: button disabled with spinner during async operation
  - Assert: re-enabled after success or error
```

---

## Pass 3 — Discount notification tests

Create `/src/__tests__/discount-notifications.test.ts`.

```
Test: "N5 — cost change notifies pending claimers"
  - Post P1 has 1 pending claim (User B)
  - Discount from $40 to $30
  - Assert: send-notification called for User B with type 'cost_changed', data includes old_cost: 40, new_cost: 30

Test: "N5 — cost change notifies approved claimers"
  - Post P2 has 1 approved claim (User B), 1 pending (User D)
  - Discount from $30 to $20
  - Assert: send-notification called for both User B and User D

Test: "N5 — does not notify rejected or unclaimed claimers"
  - Post has 1 rejected claim (User X), 1 pending (User B)
  - Discount
  - Assert: notification sent to User B only, NOT User X

Test: "N8 — price drop notifies prior viewers"
  - Post P1 has been viewed by User C (post_views row)
  - Discount from $40 to $30
  - Assert: send-notification called for User C with type 'price_drop'
  - Assert: channel is push only

Test: "N8 — price drop does not notify the poster"
  - User A has a post_views row for their own post (from viewing it)
  - Assert: User A NOT included in price drop recipients

Test: "N8 — price drop does not double-notify active claimers"
  - User B has both a claim (pending) and a post_views row on Post P1
  - Discount
  - Assert: User B receives N5 (cost change), NOT N8 (price drop)
  - Assert: send-notification called once for User B, not twice

Test: "price drop notifies notify_me watchers"
  - Post P3 has User C as a notify_me watcher
  - Discount
  - Assert: User C notified

Test: "discount with no viewers, no claimers, no watchers succeeds silently"
  - Post with zero post_views rows, zero claims, zero notify_me entries
  - Discount
  - Assert: cost updated successfully
  - Assert: no notifications sent, no errors
```

---

## Pass 4 — Time pressure label tests

Create `/src/__tests__/time-pressure-label.test.ts`.

```
Test: "shows green label when game is 14 hours away"
  - game_date + game_time = 14 hours from now
  - Assert: label shows "Game in 14h"
  - Assert: color = green (--color-primary)

Test: "shows green label when game is 13 hours away"
  - 13 hours from now
  - Assert: "Game in 13h", green

Test: "transition to amber at exactly 12 hours"
  - game = 12 hours from now
  - Assert: "Game in 12h", amber (--color-amber)

Test: "shows amber label when game is 8 hours away"
  - 8 hours from now
  - Assert: "Game in 8h", amber

Test: "shows amber label when game is 5 hours away"
  - 5 hours from now
  - Assert: "Game in 5h", amber

Test: "transition to red at exactly 4 hours"
  - game = 4 hours from now
  - Assert: "Game in 4h", red (--color-red)

Test: "shows red label when game is 2 hours away"
  - 2 hours from now
  - Assert: "Game in 2h", red

Test: "shows red label when game is 1 hour away"
  - 1 hour from now
  - Assert: "Game in 1h", red

Test: "no label when game is exactly 24 hours away"
  - 24 hours from now
  - Assert: no time pressure label in DOM

Test: "no label when game is 25 hours away"
  - 25 hours from now
  - Assert: no label

Test: "no label when game has started (0 hours)"
  - game_date + game_time = now (or in the past)
  - Assert: no label (post should be expiring, not showing urgency)

Test: "no label on regular_game posts"
  - Post with post_type = 'regular_game' (no game_date)
  - Assert: no time pressure label

Test: "hours rounded down to whole number"
  - game = 3 hours 42 minutes from now
  - Assert: label shows "Game in 3h" (not 3.7h, not 4h)

Test: "label uses both game_date AND game_time"
  - game_date = today, game_time = 11:00 PM (many hours from now if tested in morning)
  - Assert: hours calculated from current time to game_date + game_time, not just game_date

Test: "label appears on both feed SubCard and post detail page"
  - Render SubCard with Post P4 (3h away)
  - Assert: red label visible
  - Render PostDetail for Post P4
  - Assert: same red label visible
```

---

## Pass 5 — Cancellation flow tests

Create `/src/__tests__/cancellation-flow.test.tsx`.

### 5.1 Basic cancellation

```
Test: "cancel button shown on own active posts"
  - Render My Posts as User A
  - Assert: Cancel button visible on active posts

Test: "cancel button NOT shown on already-cancelled posts"
  - Assert: no Cancel button on posts with status = 'deleted'

Test: "cancel button NOT shown on expired posts"
  - Assert: no Cancel button on posts with status = 'expired'

Test: "cancel confirmation modal shows correct copy"
  - Tap Cancel on Post P1
  - Assert: modal contains "Cancel this post? All pending and approved claimers will be notified."
  - Assert: modal contains "If payment has already been made via Venmo, please coordinate directly with your sub to arrange a refund."

Test: "confirming cancel soft-deletes the post"
  - Confirm cancellation
  - Assert: posts.status = 'deleted'
  - Assert: posts.deleted_at is set (not null)
  - Assert: posts.deleted_by = User A's ID

Test: "cancelled post disappears from feed"
  - Cancel Post P1
  - Check the feed
  - Assert: Post P1 NOT visible in feed

Test: "cancelled post stays in My Activity as cancelled"
  - Cancel Post P1
  - Check My Activity > My Posts
  - Assert: Post P1 visible with "Cancelled" status indicator

Test: "dismissing cancel modal does nothing"
  - Tap Cancel, then dismiss the modal
  - Assert: post status unchanged, still active

Test: "cancel button disabled during async operation"
  - Confirm cancel
  - Assert: button disabled with loading state during Supabase call
```

### 5.2 Cancellation notifications

```
Test: "cancellation notifies pending claimers"
  - Post P1 has 1 pending claim (User B)
  - Cancel Post P1
  - Assert: send-notification called for User B

Test: "cancellation notifies approved claimers"
  - Post P2 has 1 approved (User B), 1 pending (User D)
  - Cancel Post P2
  - Assert: send-notification called for both User B and User D

Test: "cancellation does NOT notify rejected or unclaimed claimers"
  - Post has 1 rejected claim (User X)
  - Cancel
  - Assert: User X NOT notified

Test: "cancellation notification includes Venmo refund reminder"
  - Cancel post with approved claimer
  - Assert: notification data includes refund reminder text

Test: "cancellation of post with no claims sends no notifications"
  - Post has zero claims
  - Cancel
  - Assert: no send-notification calls
```

### 5.3 Series cancellation

```
Test: "series cancel prompt shown for series posts"
  - Tap Cancel on Post S2 (part of a series)
  - Assert: modal shows "Cancel this date only or all future dates in this series?"

Test: "this date only — cancels just the selected post"
  - Select "This date only" for Post S2
  - Assert: S2 status = 'deleted'
  - Assert: S1 status = 'active' (earlier date, unchanged)
  - Assert: S3 status = 'active' (later date, unchanged)

Test: "all future dates — cancels posts without approved claims"
  - Select "All future dates" from Post S2
  - Assert: S2 status = 'deleted' (no claims)
  - Assert: S3 status = 'deleted' (no claims)
  - Assert: S1 status = 'active' (has approved claim — SKIPPED)

Test: "series cancel informs poster about skipped dates"
  - Select "All future dates" with S1 having an approved claim
  - Assert: message shown: "1 date with approved claims was not cancelled" (or equivalent)

Test: "each cancelled series post notifies its own claimers"
  - S2 has 1 pending claim, S3 has 1 pending claim
  - Cancel all future
  - Assert: S2's claimer notified, S3's claimer notified — independently

Test: "series cancel does not show series prompt for non-series posts"
  - Cancel Post P1 (no series_id)
  - Assert: standard cancel modal, no "this date only / all future" option
```

---

## Pass 6 — 48h nudge integration tests

The 48h nudge Edge Function was built in Phase 7 but is closely tied to Phase 8's discount mechanic. Verify integration.

Create `/src/__tests__/48h-nudge-integration.test.ts`.

```
Test: "48h nudge suggests discounting in its message"
  - Post P3-test: created 49h ago, game in 2 days, no claims
  - Invoke the 48h-unfilled-nudge Edge Function
  - Assert: notification sent to poster
  - Assert: body includes "Consider reducing the price" or equivalent

Test: "48h nudge does not fire for posts with all spots filled"
  - Post has spots_total = 1, 1 approved claim
  - Assert: no nudge

Test: "48h nudge fires for posts with some spots still open"
  - Post has spots_total = 3, 1 approved claim
  - Assert: nudge sent

Test: "poster receives nudge, discounts, then nudge does not repeat"
  - Post P3-test receives 48h nudge
  - Poster discounts from $25 to $15
  - Invoke 48h-unfilled-nudge again
  - Assert: no second nudge (deduplicated — already sent once for this post)

Test: "48h nudge only for sub_need, not regular_game"
  - regular_game post older than 48h
  - Assert: no nudge
```

---

## Pass 7 — Run tests and fix

1. Run all tests: `npx vitest run`
2. Fix code (not tests) for any failures.
3. After all tests pass, run `npm run build` to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time.

---

## Pass 8 — Manual verification checklist

Run the app locally (`npm run dev`) in Chrome DevTools at 390px viewport width.

### Discount mechanic:

- [ ] Navigate to My Activity > My Posts. "Reduce price" button visible on active posts.
- [ ] Tap "Reduce price." Input appears for new price.
- [ ] Enter a price lower than current cost. Save. Toast confirms update.
- [ ] Post card in feed shows: original price in gray strikethrough, new price in green.
- [ ] Enter a price equal to or higher than current cost. Validation error shown inline.
- [ ] Reduce to $0. Succeeds — card shows "$0" in green, original price crossed out.
- [ ] Reduce again ($0 is already the floor). Validation rejects since new price must be lower.
- [ ] Verify in Supabase dashboard: `original_cost` set on first discount, unchanged on subsequent discounts.

### Discount notifications:

- [ ] Discount a post with a pending claimer → claimer receives push + email with old/new cost.
- [ ] Discount a post that User C has viewed → User C receives push notification (price drop).
- [ ] Verify poster does NOT receive their own price drop notification.

### Time pressure labels:

- [ ] Post P4 (game in ~3h): red "Game in 3h" label on feed card and post detail.
- [ ] Post P5 (game in ~8h): amber "Game in 8h" label.
- [ ] Post P6 (game in ~14h): green "Game in 14h" label.
- [ ] Post P7 (game in 3 days): no time pressure label.
- [ ] Regular game posts: no time pressure label.
- [ ] Labels show hours as whole numbers (no decimals).

### Cancellation flow:

- [ ] Tap Cancel on an active post. Confirmation modal appears with correct copy including Venmo refund reminder.
- [ ] Confirm → post disappears from feed, appears as "Cancelled" in My Activity.
- [ ] Post with pending claimer: claimer notified on cancellation (check Supabase notifications table or real notification delivery).
- [ ] Post with approved claimer: claimer notified with Venmo refund reminder.
- [ ] Dismiss the modal → nothing happens, post still active.

### Series cancellation:

- [ ] Cancel a series post → modal shows "This date only" / "All future dates" options.
- [ ] "This date only" cancels just that post, others in series remain active.
- [ ] "All future dates" cancels all future posts except those with approved claims.
- [ ] Message shown about skipped dates with approved claims (if any).

### Post lifecycle:

- [ ] Verify expired posts (game date passed) no longer appear in the feed (auto-expire cron from Phase 7).
- [ ] Verify expired posts appear in My Activity > My Posts with "Expired" status.
- [ ] Verify regular_game posts expire after 30 days (check a test post with `expires_at` in the past).

### Mobile UX:

- [ ] Discount input renders correctly on 390px — no overflow.
- [ ] Cancellation modal renders correctly — both lines of copy visible without scrolling.
- [ ] Time pressure labels don't wrap or overlap with other card elements.
- [ ] All touch targets minimum 44px.
- [ ] No horizontal scroll on any Phase 8 screen.
- [ ] Loading states on discount save and cancel confirm.
- [ ] Error toasts on failed discount or cancel operations.

---

## Summary of deliverables

After completing all eight passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files in `/src/__tests__/`:
   - `discount-mechanic.test.ts`
   - `discount-notifications.test.ts`
   - `time-pressure-label.test.ts`
   - `cancellation-flow.test.tsx`
   - `48h-nudge-integration.test.ts`
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. Manual verification checklist completed with all items checked.

Phase 8 is the last major feature phase before reporting (Phase 9) and admin (Phase 10). After this eval passes, the core user-facing product loop — post, browse, claim, discount, cancel — is complete and tested.
