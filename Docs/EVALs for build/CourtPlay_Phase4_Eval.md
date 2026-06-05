# CourtPlay — Phase 4 Eval: Claim Flow

## How to use this eval

Run this prompt in Claude Code after Phase 4 is complete. It validates the full claim state machine — the most complex and highest-risk feature in CourtPlay V1. Every state transition, edge case, and security boundary is tested.

The eval has four passes:

1. **Code quality audit** — Review all Phase 4 code for correctness, security, and best practices.
2. **State machine tests** — Automated tests covering every claim state transition.
3. **Integration & edge case tests** — Tests for time conflicts, spot counting, Venmo links, encryption, and the "Notify me" feature.
4. **Manual verification** — Checklist for visual/UX testing in a 390px mobile viewport.

Work through each pass sequentially. Fix issues before moving to the next pass. Do not skip ahead.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phase 3 eval passes completely — the feed, SubCard, sort order, and view tracking are all working.
4. Supabase database has the full schema applied, including:
   - `claims` table with status check constraint: `('pending','approved','rejected','unclaimed','cancelled')`
   - `notify_me` table with `unique(user_id, post_id)` constraint
   - `responsiveness_log` table
   - `notifications` table
   - All RLS policies for `claims`, `notify_me`, `responsiveness_log`, `notifications`
   - `increment_view_count` RPC function
   - `encrypt_sensitive` and `decrypt_sensitive` RPC functions (pgcrypto)
5. At least three test user accounts exist:
   - **User A** (poster) — has at least 2 active `sub_need` posts with different dates/times, phone and Venmo handle stored (encrypted).
   - **User B** (claimer) — has a complete profile with phone and Venmo handle stored (encrypted). Follows User A.
   - **User C** (second claimer) — has a complete profile. Does not follow User A.
6. At least one post by User A has `spots_total >= 2` to test multi-spot claiming.
7. At least one post by User A has a game today (within 24h) to test time pressure scenarios.

---

## Pass 1 — Code quality audit

Review every file created or modified in Phase 4. Log violations as a numbered list with file path, line number, and description.

### 1.1 File structure compliance

Verify the following files exist in the correct locations:

```
/src/components/app/ClaimButton.tsx
/src/components/app/ClaimReviewSection.tsx    (or similar — poster's claim management)
/src/components/app/PostApprovalScreen.tsx     (or similar — post-approval view)
/src/components/app/NotifyMeButton.tsx         (or similar)
/src/hooks/useClaims.ts
```

Confirm no Phase 4 code was placed in `/src/components/ui/`.

### 1.2 TypeScript quality

For every `.ts` and `.tsx` file in Phase 4:

- [ ] No `any` types. All variables, props, parameters, and return types are explicitly typed or correctly inferred.
- [ ] A `Claim` interface exists matching the database schema: `id, post_id, claimer_id, status, rejection_reason, reopen_note, created_at, resolved_at`.
- [ ] Claim status is typed as a union: `'pending' | 'approved' | 'rejected' | 'unclaimed' | 'cancelled'` — never a raw `string`.
- [ ] Rejection reason is typed as a union: `'wrong_skill_level' | 'already_filled' | 'other'` or equivalent — never a raw `string`.
- [ ] All component props use named interfaces.
- [ ] Null/undefined checks present before accessing optional fields: `rejection_reason`, `reopen_note`, `resolved_at`, decrypted phone/Venmo values.
- [ ] No type assertions (`as`) used to silence errors without justification.

### 1.3 State machine correctness

Map every claim status transition in the code and verify it matches this specification exactly:

```
open        → pending      (claimer claims)
pending     → approved     (poster approves)
pending     → rejected     (poster rejects)
pending     → unclaimed    (claimer backs out)
approved    → unclaimed    (claimer backs out)
approved    → cancelled    (poster reopens spot — Scenario B)
```

For each transition, verify:

- [ ] The Supabase `.update()` call sets the correct `status` value.
- [ ] `resolved_at` is set to `now()` on approve, reject, unclaim, and cancel — not on the initial claim insert.
- [ ] The correct party triggers the transition (claimer vs. poster). A claimer must NOT be able to approve/reject. A poster must NOT be able to unclaim on behalf of the claimer.
- [ ] RLS policies enforce these ownership boundaries at the database level — not just frontend checks.
- [ ] Invalid transitions are impossible: you cannot go from `rejected` → `approved`, from `unclaimed` → `approved`, from `cancelled` → `pending`, etc. Verify there is no code path that allows these.

### 1.4 Security & encryption

- [ ] Phone numbers and Venmo handles are decrypted ONLY on the post-approval screen, ONLY for the two parties involved (poster and approved claimer).
- [ ] Decryption uses the `decrypt_sensitive` Supabase RPC function — not client-side decryption.
- [ ] The decryption call checks claim status server-side: if the claim is not `approved`, the RPC must return null or error. A client spoofing a request with a `pending` claim ID must not receive decrypted data.
- [ ] Raw phone numbers and Venmo handles never appear in: console logs, error messages, network responses for non-approved claims, React state accessible to DevTools on non-approval screens.
- [ ] The Venmo deep link is constructed from decrypted values only on the post-approval screen. It is never pre-computed or cached in state.

### 1.5 Venmo deep link

- [ ] Format matches spec exactly:
  ```
  venmo://paycharge?txn=charge&recipients=[venmo_handle]&amount=[cost]&note=CourtPlay%20sub%20fee%20[encoded_date]%20at%20[encoded_location]
  ```
- [ ] `venmo_handle`, `cost`, `date`, and `location` are correctly URL-encoded.
- [ ] Fallback URL is `https://venmo.com/[venmo_handle]` — not the `venmo://` scheme.
- [ ] Fallback detection uses a reasonable approach: try `venmo://` first, then after a short timeout (e.g., 1500ms) redirect to web fallback. Or use `navigator.userAgent` to detect if Venmo is likely installed. Either approach is acceptable.
- [ ] Deep link is generated from live data (decrypted on render), not from stale cached values.

### 1.6 Responsiveness log

- [ ] On approve: a row is inserted into `responsiveness_log` with `event_type = 'responded'` and `response_time_hours` calculated as the difference between `claims.created_at` and `now()`.
- [ ] On reject: same as approve — `event_type = 'responded'`.
- [ ] The log insert is fire-and-forget — a failure must not block the approve/reject action or show an error to the user.
- [ ] No responsiveness data is surfaced in any V1 UI. The table is written to but never queried by user-facing code.

### 1.7 Notification triggers

Phase 4 should call a notification dispatch function (even if Phase 7 hasn't wired it up yet). Verify the following trigger points exist as function calls or placeholder hooks:

- [ ] Claim submitted → notify poster
- [ ] Claim approved → notify claimer (with Venmo deep link data)
- [ ] Claim rejected → notify claimer (with optional rejection reason)
- [ ] Claimer backs out (unclaim) → notify poster
- [ ] Spot reopened by poster (Scenario B) → notify claimer
- [ ] Spot reopened (any reason) → notify all `notify_me` watchers for this post

If Phase 7 is not yet built, these should be clearly marked as placeholder calls (e.g., `// TODO: Phase 7 — send notification`) rather than silently omitted.

### 1.8 React best practices

- [ ] Confirmation modals (claim, unclaim, reopen) use a proper modal/dialog component from Untitled UI — not `window.confirm()`.
- [ ] All async operations (claim insert, approve, reject, unclaim) show a loading state on the button (disabled + spinner) during the request.
- [ ] All async operations use try/catch with user-facing error toasts on failure.
- [ ] Optimistic UI updates are used where appropriate (e.g., spots counter updates immediately on claim, reverts on error). If not using optimistic updates, the UI must still update promptly after the Supabase call resolves.
- [ ] The ClaimButton component does not re-fetch the entire feed to update spot counts — it updates local state or uses the real-time subscription from Phase 3.
- [ ] No inline function definitions in JSX for claim action handlers.

### 1.9 Design token compliance

- [ ] ClaimButton uses `--color-primary` for the green pill, `--color-primary-hover` on hover.
- [ ] "Pending" badge uses an appropriate neutral color from the token palette.
- [ ] Rejection reason preset options are styled consistently with other selectable elements.
- [ ] Post-approval screen uses the token palette — no hardcoded hex colors.
- [ ] Spots indicator amber color uses `--color-amber` when exactly 1 spot remaining.
- [ ] Grayed-out card (all spots filled) uses `--color-text-tertiary` or equivalent subdued token.

---

## Pass 2 — State machine tests

Create `/src/__tests__/claim-state-machine.test.ts`. These tests validate the claim state machine with mock data. All transitions must be tested.

```
Test: "claim insert creates row with status pending"
  - Mock Supabase .insert() on claims table
  - Call the claim submission function with valid post_id and claimer_id
  - Assert: insert called with status = 'pending', resolved_at = null
  - Assert: post_id and claimer_id match input

Test: "claim insert does not set resolved_at"
  - Call claim submission function
  - Assert: resolved_at is null on the inserted row

Test: "approve sets status to approved and resolved_at to now"
  - Mock Supabase .update() on claims table
  - Call approve function with a pending claim ID
  - Assert: status updated to 'approved'
  - Assert: resolved_at is set (not null)

Test: "reject sets status to rejected with optional reason"
  - Call reject function with reason = 'wrong_skill_level'
  - Assert: status updated to 'rejected'
  - Assert: rejection_reason = 'wrong_skill_level'
  - Assert: resolved_at is set

Test: "reject works without a reason"
  - Call reject function with reason = null
  - Assert: status updated to 'rejected'
  - Assert: rejection_reason is null
  - Assert: resolved_at is set

Test: "unclaim by claimer sets status to unclaimed"
  - Call unclaim function for a pending claim
  - Assert: status updated to 'unclaimed'
  - Assert: resolved_at is set

Test: "unclaim works on approved claims too"
  - Call unclaim function for an approved claim
  - Assert: status updated to 'unclaimed'
  - Assert: resolved_at is set

Test: "reopen by poster sets status to cancelled with note"
  - Call reopen function with a private note
  - Assert: status updated to 'cancelled'
  - Assert: reopen_note contains the private note text
  - Assert: resolved_at is set

Test: "reopen by poster works without a note"
  - Call reopen function with note = null
  - Assert: status updated to 'cancelled'
  - Assert: reopen_note is null

Test: "responsiveness_log row inserted on approve"
  - Mock Supabase .insert() on responsiveness_log
  - Call approve function
  - Assert: insert called on responsiveness_log with event_type = 'responded'
  - Assert: response_time_hours is a positive number
  - Assert: poster_id, post_id, claim_id match the claim

Test: "responsiveness_log row inserted on reject"
  - Call reject function
  - Assert: insert called on responsiveness_log with event_type = 'responded'

Test: "responsiveness_log failure does not block approve"
  - Mock responsiveness_log .insert() to throw an error
  - Call approve function
  - Assert: claim status still updated to 'approved'
  - Assert: no error toast shown to user
```

---

## Pass 3 — Integration & edge case tests

### 3.1 Time conflict detection — `/src/__tests__/claim-time-conflict.test.ts`

```
Test: "blocks claim when user has pending claim at same date+time"
  - User B has a pending claim on Post X (game_date = April 10, game_time = 9:00 AM)
  - User B attempts to claim Post Y (same date and time)
  - Assert: claim is blocked
  - Assert: inline message shown: "You already have a pending claim on [Date] at [Time]."

Test: "blocks claim when user has approved claim at same date+time"
  - User B has an approved claim at April 10, 9:00 AM
  - User B attempts to claim another post at the same date+time
  - Assert: claim is blocked with same message

Test: "allows claim when existing claim is at a different time"
  - User B has a pending claim at April 10, 9:00 AM
  - User B claims a post at April 10, 2:00 PM
  - Assert: claim succeeds

Test: "allows claim when existing claim is at a different date"
  - User B has a pending claim at April 10, 9:00 AM
  - User B claims a post at April 11, 9:00 AM
  - Assert: claim succeeds

Test: "allows claim when existing claim at same time is unclaimed"
  - User B had a claim at April 10, 9:00 AM but unclaimed it (status = 'unclaimed')
  - User B claims a new post at April 10, 9:00 AM
  - Assert: claim succeeds (unclaimed does not block)

Test: "allows claim when existing claim at same time is rejected"
  - User B had a rejected claim at April 10, 9:00 AM
  - User B claims a new post at April 10, 9:00 AM
  - Assert: claim succeeds (rejected does not block)
```

### 3.2 Spot counter — `/src/__tests__/spot-counter.test.ts`

```
Test: "spots_available calculated correctly with no claims"
  - Post has spots_total = 4, zero claims
  - Assert: spots_available = 4

Test: "pending claims reduce spots_available"
  - Post has spots_total = 4, 1 pending claim
  - Assert: spots_available = 3

Test: "approved claims reduce spots_available"
  - Post has spots_total = 4, 1 approved claim
  - Assert: spots_available = 3

Test: "rejected claims do NOT reduce spots_available"
  - Post has spots_total = 4, 1 rejected claim
  - Assert: spots_available = 4

Test: "unclaimed claims do NOT reduce spots_available"
  - Post has spots_total = 4, 1 unclaimed claim
  - Assert: spots_available = 4

Test: "cancelled claims do NOT reduce spots_available"
  - Post has spots_total = 4, 1 cancelled claim
  - Assert: spots_available = 4

Test: "mixed claim statuses calculated correctly"
  - Post has spots_total = 4: 1 pending, 1 approved, 1 rejected, 1 unclaimed
  - Assert: spots_available = 2 (only pending + approved count)

Test: "spots_available = 0 when all spots filled"
  - Post has spots_total = 2, 2 approved claims
  - Assert: spots_available = 0

Test: "claim blocked when spots_available = 0"
  - Post has spots_total = 2, 2 pending claims
  - User C attempts to claim
  - Assert: claim is blocked
  - Assert: "Notify me if this opens up" link shown instead of Claim button

Test: "unclaiming reopens a spot"
  - Post has spots_total = 2, 2 pending claims (spots_available = 0)
  - One claimer unclaims
  - Assert: spots_available = 1
  - Assert: Claim button reappears

Test: "spots indicator shows amber when exactly 1 remaining"
  - Post has spots_total = 4, 3 pending/approved claims
  - Assert: spots indicator uses amber color (--color-amber)

Test: "card grays out when spots_available = 0"
  - Post has spots_total = 1, 1 approved claim
  - Assert: card has grayed-out visual treatment
```

### 3.3 Claim max enforcement — `/src/__tests__/claim-max.test.ts`

```
Test: "max claims per post equals number of open spots"
  - Post has spots_total = 2
  - User B claims (spots_available = 1)
  - User C claims (spots_available = 0)
  - User A (a third claimer) attempts to claim
  - Assert: claim blocked

Test: "one claim per user per post"
  - User B claims a post
  - User B attempts to claim the same post again
  - Assert: second claim blocked

Test: "user can claim same post after unclaiming"
  - User B claims, then unclaims
  - User B claims the same post again
  - Assert: second claim succeeds
```

### 3.4 Poster cannot claim own post — `/src/__tests__/claim-self.test.ts`

```
Test: "poster cannot claim their own post"
  - User A created the post
  - User A attempts to claim it
  - Assert: claim blocked or Claim button not rendered on own posts
```

### 3.5 Venmo deep link — `/src/__tests__/venmo-deeplink.test.ts`

```
Test: "venmo deep link formatted correctly"
  - Input: venmo_handle = "jane-doe-5", cost = 25, date = "April 10", location = "Longshore Club"
  - Assert: output = "venmo://paycharge?txn=charge&recipients=jane-doe-5&amount=25&note=CourtPlay%20sub%20fee%20April%2010%20at%20Longshore%20Club"

Test: "venmo deep link encodes special characters"
  - Input: location = "Town Hall & Courts"
  - Assert: location is URL-encoded in the note parameter

Test: "venmo fallback URL formatted correctly"
  - Input: venmo_handle = "jane-doe-5"
  - Assert: fallback = "https://venmo.com/jane-doe-5"

Test: "venmo deep link uses live cost, not original_cost"
  - Post was discounted from $40 to $20
  - Assert: deep link amount = 20, not 40
```

### 3.6 Notify me — `/src/__tests__/notify-me.test.ts`

```
Test: "notify_me inserts row correctly"
  - User C taps "Notify me" on a full post
  - Assert: row inserted into notify_me with correct user_id and post_id
  - Assert: confirmation toast shown

Test: "notify_me prevents duplicate entries"
  - User C taps "Notify me" twice on the same post
  - Assert: only one row exists (unique constraint enforced)
  - Assert: no error shown to user — second tap is a no-op or shows "Already watching"

Test: "notify_me link not shown when spots are available"
  - Post has spots_available > 0
  - Assert: "Notify me" link is not in the DOM

Test: "notify_me link shown when spots_available = 0"
  - Post has all spots pending or approved
  - Assert: "Notify me if this opens up" link is visible

Test: "unclaim triggers notification to notify_me watchers"
  - User C has a notify_me entry for a full post
  - A claimer unclaims
  - Assert: notification dispatch function called for User C
  - Assert: notification type is 'spot_reopened' or equivalent

Test: "rejection triggers notification to notify_me watchers"
  - User C has a notify_me entry for a full post
  - Poster rejects a claim
  - Assert: notification dispatch function called for User C

Test: "poster reopen (Scenario B) triggers notification to notify_me watchers"
  - User C has a notify_me entry
  - Poster reopens an approved spot
  - Assert: notification dispatch function called for User C
```

### 3.7 Post-approval screen — `/src/__tests__/post-approval-screen.test.tsx`

```
Test: "poster sees claimer name, decrypted phone, and Venmo deep link"
  - Render post-approval screen as the poster for an approved claim
  - Assert: claimer's first name visible
  - Assert: phone number displayed (decrypted)
  - Assert: Venmo deep link rendered as a tappable button/link

Test: "claimer sees poster name, decrypted phone, Venmo handle, and amount owed"
  - Render post-approval screen as the claimer
  - Assert: poster's first name visible
  - Assert: phone number displayed (decrypted)
  - Assert: Venmo handle visible
  - Assert: amount owed matches post cost (discounted if applicable)

Test: "both parties see game date, time, and location"
  - Render as poster and as claimer
  - Assert both views show: game date, time, location

Test: "post-approval screen not accessible for pending claims"
  - Attempt to render post-approval screen for a claim with status = 'pending'
  - Assert: decrypted data is NOT shown — screen shows an appropriate message or redirects

Test: "post-approval screen not accessible for rejected claims"
  - Attempt to render for a rejected claim
  - Assert: decrypted data is NOT shown

Test: "post-approval screen not accessible by uninvolved third party"
  - User C (not the poster, not the claimer) attempts to access the approval screen
  - Assert: access denied — decrypted data not shown
```

### 3.8 Reopen flow (Scenario B) — `/src/__tests__/reopen-flow.test.tsx`

```
Test: "reopen button shown on approved claims in My Posts"
  - Render poster's My Posts view with an approved claim
  - Assert: "Reopen spot" button is visible

Test: "reopen button NOT shown on pending claims"
  - Render poster's My Posts view with only pending claims
  - Assert: "Reopen spot" button not visible (approve/reject shown instead)

Test: "reopen confirmation modal shown on tap"
  - Tap "Reopen spot"
  - Assert: confirmation modal appears

Test: "reopen sets claim status to cancelled"
  - Confirm reopen
  - Assert: claim status updated to 'cancelled'

Test: "reopen with private note stores note on claim"
  - Enter a private note in the reopen modal and confirm
  - Assert: reopen_note field contains the note text

Test: "reopened spot flag visible in claimer's history only"
  - After reopen, render claimer's My Claims view
  - Assert: "Spot reopened by poster after approval" message visible
  - Render poster's My Posts view
  - Assert: no such message visible to poster (flag is claimer-facing only)

Test: "reopen increases spots_available"
  - Post had spots_total = 1, 1 approved claim (spots_available = 0)
  - Poster reopens
  - Assert: spots_available = 1
  - Assert: Claim button reappears on the feed card
```

### 3.9 Claim review section — `/src/__tests__/claim-review.test.tsx`

```
Test: "review section shown on posts with pending claims"
  - Render poster's My Posts view for a post with 1 pending claim
  - Assert: "Review claims" section visible

Test: "review section not shown on posts with no claims"
  - Render poster's My Posts view for a post with zero claims
  - Assert: no "Review claims" section

Test: "pending claimer shows name, photo, skill level"
  - Render claim review section with a pending claim
  - Assert: claimer's first name, avatar, and skill level badge visible

Test: "pending claimer shows Friend tag if poster follows them"
  - Poster follows the claimer
  - Assert: "Friend" tag shown next to claimer's name

Test: "approve and reject buttons shown for each pending claim"
  - Render claim review section with 2 pending claims
  - Assert: each claim row has Approve and Reject buttons

Test: "reject shows reason options"
  - Tap Reject on a pending claim
  - Assert: reason options appear — "Wrong skill level", "Already filled", "Other"
  - Assert: reason is optional — reject can proceed without selecting one
```

---

## Pass 4 — Run tests and fix

1. Run all tests: `npx vitest run`
2. Fix code (not tests) for any failures, unless the test itself contains a bug.
3. After all tests pass, run `npm run build` to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time.

---

## Pass 5 — Manual verification checklist

Run the app locally (`npm run dev`) in Chrome DevTools at 390px viewport width. Sign in as each test user to verify both perspectives.

### As the claimer (User B):

- [ ] Feed shows "Claim" green pill button on posts by other users.
- [ ] Tapping "Claim" shows a confirmation modal with location, date, and cost.
- [ ] Confirming inserts a claim — the card updates to show "Pending" badge and reduced spot count.
- [ ] Attempting to claim a second post at the same date+time shows the time conflict error message.
- [ ] "Back out" button appears in My Activity > My Claims for pending and approved claims.
- [ ] Tapping "Back out" shows confirmation modal. Confirming sets status to unclaimed and reopens the spot.
- [ ] "Notify me if this opens up" appears on posts where all spots are filled.
- [ ] Tapping "Notify me" shows confirmation toast. Tapping again is a no-op or shows "Already watching."
- [ ] Claim button does NOT appear on the claimer's own posts.

### As the poster (User A):

- [ ] My Activity > My Posts shows a "Review claims" section on posts with pending claims.
- [ ] Each pending claimer shows name, photo, skill level, and "Friend" tag if applicable.
- [ ] Tapping "Approve" updates claim to approved. Spot count updates. If all spots filled, card grays out.
- [ ] After approving, the post-approval screen shows: claimer name, decrypted phone, pre-filled Venmo deep link, game summary.
- [ ] Tapping the Venmo link opens the Venmo app (or web fallback) with pre-filled handle, amount, and note.
- [ ] Tapping "Reject" shows reason options. Reject works with and without selecting a reason.
- [ ] After rejecting, the spot reopens — spot count increases by 1.
- [ ] "Reopen spot" button appears on approved claims in My Posts.
- [ ] Reopening shows confirmation modal with optional private note field.
- [ ] After reopening, spot count increases and the Claim button reappears on the feed card.

### As the approved claimer (User B, after approval):

- [ ] Post-approval screen shows: poster name, decrypted phone, Venmo handle, amount owed, game date/time/location.
- [ ] "Back out" button still works on approved claims.

### Cross-user verification:

- [ ] User C sees updated spot counts in real-time after User B claims or unclaims (via Supabase real-time from Phase 3).
- [ ] User C cannot access the post-approval screen for User B's approved claim.
- [ ] Verify in Supabase dashboard: `responsiveness_log` rows created on approve and reject with correct `event_type` and `response_time_hours`.
- [ ] Verify in Supabase dashboard: `notify_me` rows created when users tap "Notify me."
- [ ] Verify in Supabase dashboard: raw phone and Venmo columns are encrypted (not plaintext) in the `users` table.

### Mobile UX:

- [ ] All confirmation modals render correctly on 390px viewport — no content cut off.
- [ ] All touch targets are minimum 44px (Approve, Reject, Claim, Back out, Reopen).
- [ ] Claim review section scrolls correctly if multiple pending claims exist.
- [ ] Post-approval screen is scrollable if content exceeds viewport height.
- [ ] Loading spinners shown on all async actions (claim, approve, reject, unclaim, reopen).
- [ ] Error toasts shown if any action fails (test by temporarily disabling network in DevTools).

---

## Summary of deliverables

After completing all five passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files in `/src/__tests__/`:
   - `claim-state-machine.test.ts`
   - `claim-time-conflict.test.ts`
   - `spot-counter.test.ts`
   - `claim-max.test.ts`
   - `claim-self.test.ts`
   - `venmo-deeplink.test.ts`
   - `notify-me.test.ts`
   - `post-approval-screen.test.tsx`
   - `reopen-flow.test.tsx`
   - `claim-review.test.tsx`
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. Manual verification checklist completed with all items checked.

If any test depends on Phase 7 (notifications), mark the notification dispatch call as verified-present-as-placeholder and note "full verification deferred to Phase 7 eval."
