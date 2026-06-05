# CourtPlay — Phase 11 Eval: My Activity & Post History

## How to use this eval

Run this prompt in Claude Code after Phase 11 is complete. Phase 11 is primarily a read/display phase — it aggregates posts and claims from Phases 2–8 into a unified activity view. The core challenge is correct state derivation: each post and claim card must display the right status, the right actions, and the right data depending on multiple database fields. The Scenario B flag privacy rule is the highest-risk item.

The eval has five passes:

1. **Code quality audit** — State derivation logic, data exposure rules, action routing.
2. **My Posts tab tests** — All post states, actions, series grouping.
3. **My Claims tab tests** — All claim states, actions, Venmo link, Scenario B flag.
4. **Cross-tab integration tests** — Actions taken in My Posts/Claims update the other tab and the feed.
5. **Manual verification** — Visual/UX checklist in a 390px mobile viewport.

Work through each pass sequentially. Fix issues before proceeding.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phases 3–10 evals pass completely.
4. Test data — the richest test data set yet, covering every post and claim state:

   | Entity | Details |
   |---|---|
   | **User A** (poster) | Has 8 posts covering all states. |
   | **User B** (claimer) | Has 6 claims covering all states. |
   | **User C** (second claimer) | Has 1 approved claim that was reopened (Scenario B). |

   **User A's posts (My Posts tab):**

   | Post | State | Claims | Notes |
   |---|---|---|---|
   | **P1** | Active, no claims | None | All fields editable. |
   | **P2** | Active, has pending claim | 1 pending (User B) | Locked fields. "Review claims" shown. |
   | **P3** | Active, has approved claim | 1 approved (User B) | "Reopen spot" available. |
   | **P4** | Active, all spots filled | spots_total = 2, 2 approved claims (User B + User C) | Card grayed out. |
   | **P5** | Expired, had claims | 1 approved (User B), game date passed | "Completed" state. Read-only. |
   | **P6** | Expired, no claims | None, game date passed | "Expired" state. Read-only. |
   | **P7** | Deleted/cancelled by poster | 1 pending (User B) was notified on cancel | "Cancelled" state. Read-only. |
   | **S1, S2, S3** | Series posts (shared series_id) | S1: 1 approved (User B). S2, S3: no claims. | Series grouping. S1 game = tomorrow. S2 = day after. S3 = 3 days out. |

   **User B's claims (My Claims tab):**

   | Claim | Post | Status | Notes |
   |---|---|---|---|
   | **CL1** | P2 | Pending | "Back out" button available. |
   | **CL2** | P3 | Approved | Venmo link + contact details visible. |
   | **CL3** | P5 | Approved, game passed | "Completed" state. Read-only. |
   | **CL4** | P7 | Cancelled (post was cancelled) | Read-only. |
   | **CL5** | some post | Unclaimed by User B | "Backed out" state. Read-only. |
   | **CL6** | some post | Rejected | Read-only. Shows rejection reason if provided. |

   **User C's claims (Scenario B):**

   | Claim | Post | Status | Notes |
   |---|---|---|---|
   | **CL7** | P4 | Cancelled (poster reopened — Scenario B) | `reopen_note` set. Flag: "Spot reopened by poster after approval." |

---

## Pass 1 — Code quality audit

### 1.1 File structure compliance

```
/src/pages/Activity.tsx              (or /src/pages/Activity/index.tsx)
/src/components/app/MyPostCard.tsx   (or similar — post card variant for My Posts)
/src/components/app/MyClaimCard.tsx  (or similar — claim card variant for My Claims)
```

The My Activity screen should use the existing bottom nav "My Activity" tab. Verify:

- [ ] Bottom nav "My Activity" tab navigates to `/activity`.
- [ ] The screen has two sub-tabs: "My Posts" and "My Claims."
- [ ] Tab state persists within the session — switching to feed and back remembers which tab was active.

### 1.2 TypeScript quality

- [ ] No `any` types.
- [ ] A derived `PostState` type exists covering all display states: `'active' | 'pending' | 'claimed' | 'completed' | 'expired' | 'cancelled'` — these are display states derived from database fields, not raw `posts.status` values.
- [ ] A derived `ClaimDisplayState` type: `'pending' | 'approved' | 'completed' | 'backed_out' | 'rejected' | 'cancelled'`.
- [ ] The state derivation functions are typed with clear input (database row) → output (display state) signatures.
- [ ] Series grouping logic is typed — series posts share a `series_id: string` and the grouping function returns a typed structure.

### 1.3 Post state derivation logic

My Posts must derive display states from multiple database fields. Verify the logic:

| Display state | Derivation |
|---|---|
| Active (no claims) | `posts.status = 'active'` AND zero claims with status in `('pending','approved')` |
| Pending (has claims) | `posts.status = 'active'` AND at least 1 claim with status = `'pending'` AND zero claims with status = `'approved'` |
| Claimed | `posts.status = 'active'` AND at least 1 claim with status = `'approved'` AND spots still available |
| Filled | `posts.status = 'active'` AND all spots filled (spots_available = 0) |
| Completed | `posts.status = 'expired'` AND at least 1 claim with status = `'approved'` (game happened with a confirmed sub) |
| Expired | `posts.status = 'expired'` AND zero claims with status = `'approved'` |
| Cancelled | `posts.status = 'deleted'` (poster or admin cancelled) |

- [ ] Each derivation is implemented correctly.
- [ ] The derivation handles edge cases: a post with both pending and approved claims shows as "Claimed" not "Pending."
- [ ] The derivation does not rely on string matching against display labels — it uses the database fields.

### 1.4 Claim display state derivation

My Claims must derive display states from claim status and post context:

| Display state | Derivation |
|---|---|
| Pending | `claims.status = 'pending'` AND `posts.status = 'active'` AND game not yet passed |
| Approved (upcoming) | `claims.status = 'approved'` AND game_date >= today |
| Completed | `claims.status = 'approved'` AND game_date < today (game happened) |
| Backed out | `claims.status = 'unclaimed'` (claimer backed out) |
| Rejected | `claims.status = 'rejected'` |
| Cancelled | `claims.status = 'cancelled'` (poster cancelled post or reopened spot) |

- [ ] Each derivation is implemented correctly.
- [ ] "Completed" is specifically for approved claims where the game date has passed — not for expired posts with pending claims.

### 1.5 Action availability per state

**My Posts actions:**

| Post state | Edit | Cancel | Reduce price | Review claims | Reopen spot |
|---|---|---|---|---|---|
| Active (no claims) | All fields | Yes | Yes | No | No |
| Pending (has claims) | Cost + notes only | Yes | Yes | Yes | No |
| Claimed | Cost + notes only | Yes | Yes | Yes (if pending claims too) | Yes (on approved claims) |
| Filled | Cost + notes only | Yes | Yes | No | Yes |
| Completed | None | No | No | No | No |
| Expired | None | No | No | No | No |
| Cancelled | None | No | No | No | No |

- [ ] Each action is available in the correct states and hidden in others.
- [ ] Edit respects the locking rules from Section 5.7: date, time, location, format, skill level locked after first claim.
- [ ] Read-only states (Completed, Expired, Cancelled) show no action buttons — only a summary.

**My Claims actions:**

| Claim state | Back out | View Venmo/contact | View post details |
|---|---|---|---|
| Pending | Yes | No | Yes |
| Approved (upcoming) | Yes | Yes | Yes |
| Completed | No | No (data no longer needed) | Yes (read-only) |
| Backed out | No | No | Yes (read-only) |
| Rejected | No | No | Yes (read-only) |
| Cancelled | No | No | Yes (read-only) |

- [ ] "Back out" available on pending and approved claims only.
- [ ] Venmo link and decrypted contact details shown ONLY on approved upcoming claims.
- [ ] Completed, backed out, rejected, and cancelled claims are fully read-only.

### 1.6 Scenario B flag — CRITICAL PRIVACY CHECK

The product plan states: "Scenario B flags visible in claimer's own history only."

- [ ] When a poster reopens an approved claim (status = 'cancelled', `reopen_note` set), the claimer sees: "The poster reopened this spot after approving your claim."
- [ ] This message is visible ONLY in the claimer's own My Claims view. It is NOT visible:
  - In the poster's My Posts view (the poster sees the claim as cancelled but no flag about their own action)
  - In any other user's view
  - In the feed
  - In the post detail page
  - In the admin dashboard (admin can see the `reopen_note` field but not the user-facing flag text — the flag is a UI-layer message, not stored text)
- [ ] The flag message is neutral in tone — "The poster reopened this spot after approving your claim." — not accusatory.
- [ ] The flag is NOT shown on claims with status = 'cancelled' due to post cancellation (the entire post was cancelled). It is ONLY shown when `claims.status = 'cancelled'` AND the cause was a reopen (distinguish by: `reopen_note` is not null, or by checking if the post is still active while the claim is cancelled).

### 1.7 Data exposure

- [ ] My Posts queries only return the current user's posts (`author_id = auth.uid()`).
- [ ] My Claims queries only return the current user's claims (`claimer_id = auth.uid()`).
- [ ] The claim review section in My Posts shows claimer profiles (name, photo, skill level) but NOT their phone, email, or Venmo — those are only revealed post-approval via the Phase 4 approval screen.
- [ ] Completed claims do NOT show decrypted contact details — the game is over, the data is no longer needed.
- [ ] Expired and cancelled post summaries do NOT show any claimer contact details.

### 1.8 React best practices

- [ ] The My Activity screen shows a loading skeleton while data fetches.
- [ ] Tab switching is instant (data for both tabs is either pre-fetched or cached after first load).
- [ ] The post and claim lists are scrollable.
- [ ] Empty states exist for each tab: "You haven't posted any sub needs yet" and "You haven't claimed any spots yet" with CTAs to post or browse.
- [ ] Post and claim cards use `React.memo` to avoid unnecessary re-renders when the list state changes.
- [ ] All action buttons (Edit, Cancel, Back out, Reopen) are disabled during their async operations.
- [ ] All errors show toasts with retry.

### 1.9 Design token compliance

- [ ] No hardcoded hex colors.
- [ ] State badges use distinct but consistent colors:
  - Active: `--color-primary`
  - Pending: amber or neutral
  - Approved/Claimed: `--color-primary`
  - Completed: `--color-text-secondary` (muted)
  - Expired: `--color-text-tertiary` (muted)
  - Cancelled/Backed out: `--color-text-tertiary`
  - Rejected: `--color-red` or neutral
- [ ] Read-only cards have a subdued visual treatment — not identical to active cards.
- [ ] Series group header uses a distinct visual treatment from individual cards.

---

## Pass 2 — My Posts tab tests

Create `/src/__tests__/my-posts.test.tsx`.

### 2.1 State rendering

```
Test: "active post with no claims shows Active state"
  - Sign in as User A
  - Assert: P1 shows "Active" badge
  - Assert: edit button, cancel button, reduce price button visible

Test: "active post with pending claim shows Pending state"
  - Assert: P2 shows "Pending" badge or claim indicator
  - Assert: "Review claims" section visible with User B's pending claim

Test: "active post with approved claim shows Claimed state"
  - Assert: P3 shows "Claimed" badge
  - Assert: "Reopen spot" button visible for User B's approved claim

Test: "active post with all spots filled shows Filled state"
  - Assert: P4 shows filled/grayed treatment
  - Assert: "Reopen spot" available for each approved claim

Test: "expired post with approved claims shows Completed state"
  - Assert: P5 shows "Completed" badge
  - Assert: read-only — no edit, cancel, or action buttons

Test: "expired post with no claims shows Expired state"
  - Assert: P6 shows "Expired" badge
  - Assert: read-only

Test: "deleted post shows Cancelled state"
  - Assert: P7 shows "Cancelled" badge
  - Assert: read-only

Test: "completed and expired posts stay in history permanently"
  - Assert: P5 and P6 visible in My Posts (not filtered out)
  - Assert: they remain visible even after weeks (no auto-purge)
```

### 2.2 Post actions

```
Test: "edit all fields on active post with no claims"
  - P1 (active, no claims): tap Edit
  - Assert: all fields editable — date, time, skill level, location, format, total players, cost, spots, notes

Test: "edit locked fields on active post with claims"
  - P2 (active, has pending claim): tap Edit
  - Assert: cost and notes editable
  - Assert: date, time, location, format, skill level shown as locked with tooltip "Cancel and repost to change game details"
  - Assert: spots editable (increase only)

Test: "cancel from My Posts triggers cancellation flow"
  - P1: tap Cancel
  - Assert: confirmation modal from Phase 8 cancellation flow appears
  - Assert: on confirm, post status = 'deleted'

Test: "reduce price from My Posts triggers discount flow"
  - P2: tap Reduce price
  - Assert: discount input from Phase 8 appears
  - Assert: saves correctly, notifications fire

Test: "review claims section shows pending claimers"
  - P2: Review claims section visible
  - Assert: User B shown with name, photo, skill level
  - Assert: Approve and Reject buttons visible

Test: "approve from My Posts triggers Phase 4 approval flow"
  - Approve User B's claim on P2
  - Assert: claim status = 'approved', notifications fire, post-approval screen accessible

Test: "reject from My Posts triggers Phase 4 rejection flow"
  - Reject a claim with reason
  - Assert: claim status = 'rejected', claimer notified

Test: "reopen spot from My Posts triggers Phase 4 reopen flow"
  - P3: tap Reopen on User B's approved claim
  - Assert: confirmation modal with optional private note
  - Assert: claim status = 'cancelled', reopen_note stored
```

### 2.3 Series grouping

```
Test: "series posts grouped under one header"
  - S1, S2, S3 share series_id
  - Assert: displayed as a group with header "X of Y dates" (e.g., "3 dates")

Test: "series group shows individual date cards"
  - Assert: each date in the series visible within the group
  - Assert: each shows its own state (S1 = claimed, S2 = active, S3 = active)

Test: "series bulk cancel available"
  - Assert: bulk cancel option on the series group header
  - Tap bulk cancel
  - Assert: Phase 8 series cancellation modal appears with "This date only" / "All future dates"

Test: "series group shows spots summary per date"
  - S1: 1 approved claim, S2: no claims, S3: no claims
  - Assert: each date card shows its own spots indicator

Test: "non-series posts do not show series grouping"
  - P1 (no series_id) displayed as individual card
  - Assert: no group header, no bulk actions
```

### 2.4 Spots summary on post cards

```
Test: "active post card shows spots summary"
  - P2 (1 pending claim, spots_total = 1): assert "0/1 available" or "1 pending"
  - P4 (2 approved, spots_total = 2): assert "0/2 available" or "Filled"

Test: "spots summary updates after claim action"
  - Approve User B's claim on P2
  - Assert: spots summary updates to reflect the new state
```

---

## Pass 3 — My Claims tab tests

Create `/src/__tests__/my-claims.test.tsx`.

### 3.1 State rendering

```
Test: "pending claim shows Pending state with Back out button"
  - Sign in as User B
  - Assert: CL1 shows "Pending" state
  - Assert: "Back out" button visible
  - Assert: post summary visible (format, date, time, location, cost)

Test: "approved upcoming claim shows Approved state with contact details"
  - Assert: CL2 shows "Approved" state
  - Assert: poster name, decrypted phone, Venmo handle, amount owed visible
  - Assert: pre-filled Venmo deep link visible
  - Assert: game date, time, location summary visible
  - Assert: "Back out" button visible

Test: "completed claim shows Completed state — read-only"
  - Assert: CL3 shows "Completed" state
  - Assert: no action buttons
  - Assert: no decrypted contact details (game is over)
  - Assert: post summary visible as read-only

Test: "cancelled claim from post cancellation shows Cancelled state"
  - Assert: CL4 shows "Cancelled" state
  - Assert: read-only, no actions

Test: "unclaimed claim shows Backed Out state"
  - Assert: CL5 shows "Backed out" state
  - Assert: read-only

Test: "rejected claim shows Rejected state"
  - Assert: CL6 shows "Rejected" state
  - Assert: rejection reason visible if one was provided
  - Assert: read-only
```

### 3.2 Claim grouping

```
Test: "claims grouped by status"
  - Assert: claims organized into sections — Pending, Approved, Completed, Backed out/Rejected/Cancelled
  - Assert: sections are in logical order (active states first, historical last)

Test: "empty section not shown"
  - If User B has no rejected claims
  - Assert: "Rejected" section not rendered (no empty section header)
```

### 3.3 Claim actions

```
Test: "back out from pending claim"
  - CL1: tap "Back out"
  - Assert: confirmation modal from Phase 4 unclaim flow
  - Assert: on confirm, claim status = 'unclaimed', poster notified

Test: "back out from approved claim"
  - CL2: tap "Back out"
  - Assert: confirmation modal
  - Assert: on confirm, claim status = 'unclaimed', poster notified

Test: "back out not available on completed claims"
  - CL3: assert no "Back out" button

Test: "back out not available on rejected claims"
  - CL6: assert no "Back out" button
```

### 3.4 Venmo link and contact details

```
Test: "approved upcoming claim shows Venmo deep link"
  - CL2 (approved, game date future)
  - Assert: Venmo deep link rendered as tappable button
  - Assert: link format matches spec: venmo://paycharge?txn=charge&recipients=[handle]&amount=[cost]&note=...
  - Assert: amount uses current cost (discounted if applicable)

Test: "approved upcoming claim shows decrypted poster phone"
  - Assert: poster's phone number visible (decrypted via pgcrypto RPC)

Test: "approved upcoming claim shows poster Venmo handle"
  - Assert: poster's Venmo handle visible

Test: "completed claim does NOT show contact details"
  - CL3 (completed, game passed)
  - Assert: no phone number, no Venmo handle, no Venmo link

Test: "pending claim does NOT show contact details"
  - CL1 (pending)
  - Assert: no phone, no Venmo, no decrypted data

Test: "rejected claim does NOT show contact details"
  - Assert: no decrypted data
```

### 3.5 Scenario B flag — the critical privacy test

```
Test: "reopened claim shows flag in claimer's own view"
  - Sign in as User C
  - CL7 (cancelled via reopen, reopen_note set)
  - Assert: message visible: "The poster reopened this spot after approving your claim."

Test: "reopened claim flag is neutral in tone"
  - Assert: message text is exactly "The poster reopened this spot after approving your claim." or close equivalent
  - Assert: no accusatory language (not "Poster cancelled your claim", not "Payment issue")

Test: "reopened claim flag NOT visible to the poster"
  - Sign in as User A (the poster who reopened)
  - Navigate to My Posts, find the post associated with CL7
  - Assert: the claim shows as cancelled but NO flag text about reopening is visible to the poster

Test: "reopened claim flag NOT visible to other users"
  - Sign in as User B
  - Assert: User C's Scenario B flag not visible anywhere — User B cannot see User C's claim history

Test: "reopened claim flag NOT visible in feed"
  - Assert: the post card in the feed shows no Scenario B information

Test: "reopened claim flag NOT visible on post detail page"
  - Navigate to /post/[post ID for CL7's post]
  - Assert: no Scenario B flag

Test: "cancelled claim from post deletion does NOT show reopen flag"
  - CL4 (cancelled because post P7 was deleted)
  - Sign in as User B
  - Assert: CL4 shows "Cancelled" state but NO "poster reopened" message
  - Assert: distinction is made by checking reopen_note (null for post cancellation, set for reopen)

Test: "reopen_note field not exposed to claimer in UI"
  - CL7's reopen_note contains a private admin note from the poster
  - Assert: the private note text is NOT shown to User C — only the generic flag message is shown
  - Assert: reopen_note content is only visible in the admin dashboard (Phase 10)
```

---

## Pass 4 — Empty states and edge cases

Create `/src/__tests__/my-activity-edge-cases.test.tsx`.

```
Test: "My Posts empty state for user with no posts"
  - New user with zero posts
  - Assert: "You haven't posted any sub needs yet." message
  - Assert: CTA button to create a post ("Find a Sub" or equivalent)

Test: "My Claims empty state for user with no claims"
  - New user with zero claims
  - Assert: "You haven't claimed any spots yet." message
  - Assert: CTA button to browse feed

Test: "tab switching preserves scroll position"
  - Scroll down in My Posts
  - Switch to My Claims
  - Switch back to My Posts
  - Assert: scroll position restored (or at least not reset to top)

Test: "real-time updates reflected in My Activity"
  - User A is viewing My Posts
  - User B claims a spot on one of User A's active posts (from another session)
  - Assert: User A's My Posts updates to show the new pending claim without a full page refresh

Test: "My Activity accessible from bottom nav"
  - Tap "My Activity" in bottom nav
  - Assert: navigates to /activity
  - Assert: correct tab is active

Test: "My Posts shows correct count of posts"
  - User A has 8 posts (P1–P7 + series S1–S3)
  - Assert: all 8+ posts visible (series may show as grouped but all dates accounted for)

Test: "posts ordered by recency or game date"
  - Assert: posts sorted in a logical order — either soonest game date first (for active) or most recent first
  - Assert: completed and expired posts sort after active posts
```

---

## Pass 5 — Cross-tab integration tests

Create `/src/__tests__/my-activity-integration.test.ts`.

```
Test: "approving a claim in My Posts updates My Claims for the claimer"
  - User A approves User B's claim on P2 (from My Posts > Review claims)
  - User B opens My Claims
  - Assert: CL1 now shows "Approved" state with Venmo link and contact details

Test: "backing out in My Claims updates My Posts for the poster"
  - User B backs out of CL2 (approved claim on P3) from My Claims
  - User A opens My Posts
  - Assert: P3 shows spot reopened, claim no longer in approved state

Test: "cancelling a post in My Posts updates My Claims for all claimers"
  - User A cancels P2 (has pending claim CL1 by User B)
  - User B opens My Claims
  - Assert: CL1 shows "Cancelled" state

Test: "discount in My Posts reflects in My Claims"
  - User A discounts P3 from $30 to $20
  - User B views CL2 (approved claim on P3) in My Claims
  - Assert: amount owed shows $20
  - Assert: Venmo deep link uses $20

Test: "actions in My Activity trigger correct Phase 7 notifications"
  - Approve, reject, back out, cancel from My Activity
  - Assert: each action triggers the same notification as when performed from the feed or post detail page

Test: "feed reflects state changes made from My Activity"
  - User A cancels P1 from My Posts
  - Assert: P1 disappears from the public feed
```

---

## Pass 6 — Run tests and fix

1. Run all tests: `npx vitest run`
2. Fix code (not tests) for any failures.
3. After all tests pass, run `npm run build` to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time.

---

## Pass 7 — Manual verification checklist

Run the app locally (`npm run dev`) in Chrome DevTools at 390px viewport width.

### My Posts tab (sign in as User A):

- [ ] Bottom nav "My Activity" → `/activity`. My Posts tab active by default.
- [ ] P1 (active, no claims): "Active" badge. Edit, Cancel, Reduce price buttons visible.
- [ ] P2 (active, pending claim): pending indicator. "Review claims" section with User B's name, photo, skill level. Approve/Reject buttons.
- [ ] P3 (active, approved claim): "Claimed" indicator. "Reopen spot" button on approved claim.
- [ ] P4 (filled): grayed treatment. "Reopen spot" on each approved claim.
- [ ] P5 (completed): "Completed" badge. Read-only. No action buttons.
- [ ] P6 (expired): "Expired" badge. Read-only.
- [ ] P7 (cancelled): "Cancelled" badge. Read-only.
- [ ] S1–S3 (series): grouped under one header showing "3 dates." Each date card shows its own state. Bulk cancel option available.
- [ ] Tap Edit on P1 → all fields editable. Save works.
- [ ] Tap Edit on P2 → cost and notes editable. Date/time/location/format/skill level locked with tooltip.
- [ ] Tap Cancel on P1 → Phase 8 cancellation modal.
- [ ] Tap Reduce price on P2 → Phase 8 discount input.
- [ ] Tap Approve on P2's pending claim → Phase 4 approval flow. Post-approval screen shows.
- [ ] Tap Reopen on P3's approved claim → Phase 4 reopen flow.

### My Claims tab (sign in as User B):

- [ ] Switch to My Claims tab.
- [ ] CL1 (pending): "Pending" badge. "Back out" button visible. Post summary (format, date, time, location, cost). No contact details.
- [ ] CL2 (approved, upcoming): "Approved" badge. Poster name, phone (decrypted), Venmo handle, amount owed, Venmo deep link. "Back out" button.
- [ ] CL3 (completed): "Completed" badge. Read-only. No contact details. Post summary.
- [ ] CL4 (cancelled from post deletion): "Cancelled" badge. Read-only. No reopen flag.
- [ ] CL5 (backed out): "Backed out" badge. Read-only.
- [ ] CL6 (rejected): "Rejected" badge. Rejection reason shown if provided. Read-only.
- [ ] Tap "Back out" on CL1 → Phase 4 unclaim confirmation modal.
- [ ] Tap Venmo link on CL2 → Venmo app opens (or web fallback).
- [ ] Claims grouped by status with active states first.

### Scenario B flag (sign in as User C):

- [ ] My Claims shows CL7 (cancelled via reopen). Message: "The poster reopened this spot after approving your claim."
- [ ] The `reopen_note` private text is NOT visible — only the generic flag.
- [ ] Sign in as User A (the poster). My Posts shows the claim as cancelled but NO reopen flag text.
- [ ] Check the feed — no Scenario B information visible on any post card.

### Empty states:

- [ ] Create a new test user with no posts or claims.
- [ ] My Posts: "You haven't posted any sub needs yet." with CTA.
- [ ] My Claims: "You haven't claimed any spots yet." with CTA.

### Mobile UX:

- [ ] Tab switching is snappy — no visible reload or flicker.
- [ ] Cards scroll vertically. Series groups expand/collapse cleanly.
- [ ] All touch targets minimum 44px (Edit, Cancel, Back out, Approve, Reject, Reopen).
- [ ] No horizontal scroll at 390px.
- [ ] Bottom nav does not obscure the last card (bottom padding sufficient).
- [ ] Loading skeleton shown on initial tab load.
- [ ] Error toast with retry if data fetch fails.

---

## Summary of deliverables

After completing all seven passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files in `/src/__tests__/`:
   - `my-posts.test.tsx`
   - `my-claims.test.tsx`
   - `my-activity-edge-cases.test.tsx`
   - `my-activity-integration.test.ts`
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. Manual verification checklist completed with all items checked.

Phase 11 is the last user-facing feature phase before the landing page and polish (Phase 12). After this eval passes, every user-facing screen in CourtPlay V1 is built and tested.
