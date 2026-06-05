# CourtPlay — Phase 9 Eval: Reporting & Safety

## How to use this eval

Run this prompt in Claude Code after Phase 9 is complete. Phase 9 is the smallest feature phase — it adds reporting for posts and users, routing to an admin queue built in Phase 10. The scope is narrow but the stakes are high: reporting is a safety feature, and bugs here (leaking reporter identity, notifying the reported user, allowing report spam) erode community trust.

The eval has four passes:

1. **Code quality audit** — Review all Phase 9 code for correctness, security, and anonymity enforcement.
2. **Report post tests** — ⋯ menu, reason selection, note, database insertion, confirmation.
3. **Report user tests** — Profile page ⋯ menu, same flow, correct target_type/target_id.
4. **Manual verification** — Visual/UX checklist in a 390px mobile viewport.

Work through each pass sequentially. Fix issues before proceeding.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phases 3–8 evals pass completely.
4. Supabase database has the full schema applied, including:
   - `reports` table with check constraints: `target_type in ('post','user')`, `status in ('pending','dismissed','actioned')`
   - RLS: users can insert own reports (`auth.uid() = reporter_id`), admins have full access, no regular user select policy.
5. Test data:

   | Entity | Details |
   |---|---|
   | **User A** | Active user with 2 active posts (Post P1, Post P2). |
   | **User B** | Active user. Will file reports. |
   | **User C** | Active user. Will be reported. |
   | **User D** | Suspended user (`is_suspended = true`). |
   | **User E** | Admin user (`is_admin = true`). |
   | **Post P1** | Active sub_need by User A. |
   | **Post P2** | Active regular_game by User A. |

---

## Pass 1 — Code quality audit

### 1.1 File structure compliance

Verify the following files exist:

```
/src/components/app/ReportPostModal.tsx     (or ReportModal.tsx shared)
/src/components/app/ReportUserModal.tsx      (or same shared component with target_type param)
```

The ⋯ menu should already exist on SubCard, GroupCard (Phase 3), and the profile page (Phase 6). Phase 9 adds the "Report" option inside these menus. Verify:

- [ ] SubCard has a ⋯ menu with "Report this post" as an option.
- [ ] GroupCard has a ⋯ menu with "Report this post" as an option.
- [ ] Profile page has a ⋯ menu with "Report this user" as an option.
- [ ] The ⋯ menu is only visible to authenticated users — unauthenticated users on the post detail page (Phase 5 deep link preview) do NOT see it.

### 1.2 TypeScript quality

- [ ] No `any` types in Phase 9 code.
- [ ] A `ReportReason` union type exists: `'spam' | 'inappropriate' | 'incorrect_info' | 'other'` (or equivalent matching the check constraint values stored in the database).
- [ ] A `ReportTargetType` union type: `'post' | 'user'`.
- [ ] A `Report` interface exists matching the schema: `id, reporter_id, target_type, target_id, reason, note, status, reviewed_by, reviewed_at, created_at`.
- [ ] The note field is typed as `string | null` — the component handles both.
- [ ] The `target_id` is typed as `string` (UUID) and validated before insertion.

### 1.3 Report anonymity — CRITICAL

This is the highest-priority check in Phase 9. The reporter must remain anonymous to the reported user.

- [ ] No notification of any kind is sent to the reported user when a report is submitted. Verify: no `send-notification` call, no database insert into `notifications` for the reported user, no push, no email.
- [ ] The reported user cannot query the `reports` table to see reports against them. Verify: no RLS `select` policy exists for regular users on the `reports` table. Only admins can read reports.
- [ ] The reporter's identity (`reporter_id`) is never exposed in any user-facing UI, API response, or network payload accessible to the reported user.
- [ ] The confirmation toast shown to the reporter does NOT include the reported user's name or any identifying info about the target — just a generic "Thanks for your report."
- [ ] If the report modal encounters an error, the error message does NOT leak the reporter's identity or the report contents.

### 1.4 Report insertion correctness

- [ ] On submit, a row is inserted into `reports` with:
  - `reporter_id` = authenticated user's ID
  - `target_type` = `'post'` or `'user'`
  - `target_id` = the post ID or user ID being reported
  - `reason` = one of the four options (required — radio selection, not optional)
  - `note` = optional text (null if not provided)
  - `status` = `'pending'` (default)
  - `reviewed_by` = null
  - `reviewed_at` = null
- [ ] The insert uses `auth.uid()` for `reporter_id` — not a value passed from the frontend. This prevents spoofing.
- [ ] The insert respects the RLS policy: `auth.uid() = reporter_id`.

### 1.5 Input validation

- [ ] Reason is required — the submit button is disabled until a reason is selected.
- [ ] Note field has a 150-character max. A character counter is shown. Input is blocked or truncated at 150.
- [ ] Note field allows empty (null) — it is optional.
- [ ] The `target_id` is validated as a UUID before the insert — a malformed ID does not reach Supabase.
- [ ] The report form does not allow submission without authentication. If the session expires mid-report, the user is redirected to sign-in.

### 1.6 Duplicate report handling

The spec doesn't explicitly prevent duplicate reports, but consider:

- [ ] A user CAN submit multiple reports for the same target (different reasons over time — this is acceptable).
- [ ] However, rapid duplicate submissions (double-tap) should be prevented — the submit button is disabled during the async operation and re-enabled only on error.
- [ ] Optionally: if a user has already submitted a report for this exact target_id with the same reason, show a note: "You've already reported this." This is a nice-to-have, not a requirement.

### 1.7 Report from different surfaces

The report flow is triggered from three surfaces. Verify all three work:

- [ ] **Feed SubCard ⋯ menu → "Report this post"** — `target_type = 'post'`, `target_id = post.id`
- [ ] **Feed GroupCard ⋯ menu → "Report this post"** — `target_type = 'post'`, `target_id = post.id`
- [ ] **Post detail page ⋯ menu → "Report this post"** — same as above
- [ ] **Profile page ⋯ menu → "Report this user"** — `target_type = 'user'`, `target_id = user.id`

### 1.8 Self-report prevention

- [ ] A user cannot report their own post. Either:
  - The ⋯ menu on their own posts does not include "Report this post", or
  - Tapping it shows a message: "You can't report your own post."
- [ ] A user cannot report themselves. Either:
  - The ⋯ menu on their own profile does not include "Report this user", or
  - The option is not shown on `/profile/me`.

### 1.9 React best practices

- [ ] The report modal is a bottom sheet (Untitled UI BottomSheet or Modal) — not `window.confirm()` or `window.prompt()`.
- [ ] The modal opens from the ⋯ menu on tap — one tap to open menu, one tap on "Report" to open the modal.
- [ ] The submit button shows a loading state during the async insert.
- [ ] On success: modal closes and confirmation toast appears. The toast uses Untitled UI Toast component.
- [ ] On error: error toast shown. Modal stays open so the user can retry.
- [ ] The modal is dismissable by tapping outside, swiping down (bottom sheet), or a close button.
- [ ] The ⋯ menu closes when the report modal opens — they are not stacked.

### 1.10 Design token compliance

- [ ] No hardcoded hex colors in any Phase 9 component.
- [ ] ⋯ menu icon uses `--color-text-secondary`.
- [ ] Radio buttons for reason selection use `--color-primary` for the selected state.
- [ ] Submit button uses `--color-primary` background.
- [ ] Character counter uses `--color-text-tertiary`, switching to `--color-red` when near or at the 150 limit.
- [ ] Confirmation toast uses the standard success style from Untitled UI.

### 1.11 Accessibility

- [ ] ⋯ menu button has `aria-label="More options"` or equivalent.
- [ ] The report modal has a descriptive `aria-label` (e.g., "Report this post").
- [ ] Radio buttons for reason are keyboard-navigable and have visible focus states.
- [ ] Note textarea has a visible label or `aria-label`.
- [ ] The modal traps focus — tabbing does not escape to the background content.

---

## Pass 2 — Report post tests

Create `/src/__tests__/report-post.test.tsx`.

```
Test: "⋯ menu on SubCard contains Report this post option"
  - Render SubCard for Post P1 as User B (authenticated)
  - Open ⋯ menu
  - Assert: "Report this post" option visible

Test: "⋯ menu on GroupCard contains Report this post option"
  - Render GroupCard for Post P2 as User B
  - Open ⋯ menu
  - Assert: "Report this post" option visible

Test: "⋯ menu on post detail page contains Report this post"
  - Render PostDetail for Post P1 as User B
  - Assert: ⋯ menu with "Report this post" visible

Test: "⋯ menu NOT shown to unauthenticated users"
  - Render PostDetail for Post P1 as unauthenticated (deep link preview)
  - Assert: ⋯ menu NOT in DOM

Test: "tapping Report this post opens bottom sheet modal"
  - Open ⋯ menu, tap "Report this post"
  - Assert: bottom sheet modal opens
  - Assert: four reason options visible: Spam, Inappropriate content, Incorrect information, Other

Test: "reason selection is required — submit disabled without selection"
  - Open report modal
  - Assert: submit button disabled
  - Select "Spam"
  - Assert: submit button enabled

Test: "note field accepts up to 150 characters"
  - Open report modal
  - Type 150 characters in note field
  - Assert: all 150 characters accepted
  - Type 151st character
  - Assert: blocked or truncated at 150
  - Assert: character counter shows "150/150"

Test: "note field is optional"
  - Select a reason, leave note empty
  - Tap submit
  - Assert: report inserted successfully with note = null

Test: "successful report inserts correct row into reports table"
  - User B reports Post P1 with reason = 'spam', note = 'Looks like advertising'
  - Assert: row inserted with:
    - reporter_id = User B's ID
    - target_type = 'post'
    - target_id = Post P1's ID
    - reason = 'spam'
    - note = 'Looks like advertising'
    - status = 'pending'
    - reviewed_by = null
    - reviewed_at = null

Test: "confirmation toast shown after successful report"
  - Submit a report
  - Assert: modal closes
  - Assert: toast appears: "Thanks for your report. Our team will review it."

Test: "no notification sent to post author"
  - User B reports Post P1 (by User A)
  - Assert: no send-notification call for User A
  - Assert: no row in notifications table for User A related to this report

Test: "error during submit shows error toast and keeps modal open"
  - Mock Supabase insert to reject
  - Submit report
  - Assert: error toast shown
  - Assert: modal still open with selections preserved

Test: "submit button disabled during async operation"
  - Submit report
  - Assert: button shows loading state (disabled + spinner) during Supabase call
  - Assert: prevents double-tap submission

Test: "self-report prevented — cannot report own post"
  - Render SubCard for a post authored by User B, as User B
  - Open ⋯ menu
  - Assert: "Report this post" NOT shown, or tapping it shows a blocking message

Test: "modal dismissable by tapping outside"
  - Open report modal
  - Tap outside the modal
  - Assert: modal closes with no submission

Test: "modal dismissable by close button"
  - Open report modal
  - Tap close button (X)
  - Assert: modal closes with no submission
```

---

## Pass 3 — Report user tests

Create `/src/__tests__/report-user.test.tsx`.

```
Test: "⋯ menu on profile page contains Report this user option"
  - Navigate to /profile/[User C ID] as User B
  - Open ⋯ menu
  - Assert: "Report this user" option visible

Test: "Report this user NOT shown on own profile"
  - Navigate to /profile/me as User B (or /profile/[User B ID])
  - Assert: ⋯ menu not shown, OR "Report this user" not in menu

Test: "tapping Report this user opens bottom sheet modal"
  - Open ⋯ menu on User C's profile, tap "Report this user"
  - Assert: bottom sheet modal opens
  - Assert: same four reason options as post report

Test: "successful user report inserts correct row"
  - User B reports User C with reason = 'inappropriate', note = null
  - Assert: row inserted with:
    - reporter_id = User B's ID
    - target_type = 'user'
    - target_id = User C's ID
    - reason = 'inappropriate'
    - note = null
    - status = 'pending'

Test: "no notification sent to reported user"
  - User B reports User C
  - Assert: no notification of any kind sent to User C

Test: "confirmation toast shown after user report"
  - Submit report
  - Assert: toast: "Thanks for your report. Our team will review it."

Test: "can report a user from different profiles"
  - User B reports User A from User A's profile
  - User B reports User C from User C's profile
  - Assert: both reports inserted with correct target_ids

Test: "report user modal has same validation as report post"
  - Reason required — submit disabled without selection
  - Note max 150 characters
  - Submit button disabled during async
```

---

## Pass 4 — Security and RLS tests

Create `/src/__tests__/report-security.test.ts`.

```
Test: "regular user cannot read reports table"
  - Sign in as User B (non-admin)
  - Query: select * from reports
  - Assert: returns empty or RLS blocks the query (no rows returned)

Test: "regular user cannot read reports against themselves"
  - User A has been reported by User B
  - Sign in as User A
  - Query: select * from reports where target_id = [User A's ID]
  - Assert: returns empty (RLS blocks)

Test: "admin can read all reports"
  - Sign in as User E (admin)
  - Query: select * from reports
  - Assert: all report rows returned

Test: "reporter_id is set from auth.uid(), not from frontend payload"
  - Attempt to insert a report with reporter_id = User C's ID while authenticated as User B
  - Assert: RLS rejects the insert (auth.uid() != reporter_id)

Test: "regular user cannot update reports"
  - User B tries to update a report's status
  - Assert: RLS blocks the update (no update policy for regular users)

Test: "regular user cannot delete reports"
  - User B tries to delete a report
  - Assert: RLS blocks the delete (no delete policy for regular users)

Test: "report against suspended user still accepted"
  - User B reports User D (suspended)
  - Assert: report inserted successfully (the user may be suspended for other reasons, reports still valid)

Test: "report against non-existent user ID handled gracefully"
  - User B attempts to report target_id = [non-existent UUID]
  - Assert: report inserted (the reports table doesn't enforce FK on target_id — it's a UUID, not a reference)
  - OR: if the frontend validates target_id against a user lookup, assert: validation error shown
```

---

## Pass 5 — Edge case tests

Create `/src/__tests__/report-edge-cases.test.ts`.

```
Test: "user can report the same post with different reasons"
  - User B reports Post P1 with reason = 'spam'
  - User B reports Post P1 again with reason = 'incorrect_info'
  - Assert: two separate rows in reports table

Test: "multiple users can report the same post"
  - User B reports Post P1
  - User C reports Post P1
  - Assert: two rows with different reporter_ids, same target_id

Test: "multiple users can report the same user"
  - User B reports User C
  - User A reports User C
  - Assert: two rows with different reporter_ids

Test: "report note with special characters stored correctly"
  - Submit report with note = "This is <suspicious> & weird 'post'"
  - Assert: note stored as-is in database (not HTML-escaped at storage, but sanitized on display)

Test: "report note with only whitespace treated as null"
  - Submit report with note = "   " (spaces only)
  - Assert: note stored as null or trimmed to empty (not as whitespace)

Test: "report flow works on post detail page (deep link surface)"
  - Navigate to /post/[P1 ID] as authenticated User B
  - Open ⋯ menu, report
  - Assert: report inserted with correct post target_id

Test: "rapid double-tap does not create duplicate reports"
  - Tap submit twice rapidly
  - Assert: only one report row inserted (button disabled after first tap)
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

### Report post from feed:

- [ ] On a SubCard, tap ⋯ menu. "Report this post" option visible.
- [ ] Tap "Report this post." Bottom sheet modal slides up.
- [ ] Four reason options shown as radio buttons: Spam, Inappropriate content, Incorrect information, Other.
- [ ] Submit button disabled until a reason is selected.
- [ ] Select "Spam." Submit button enables.
- [ ] Type a note (e.g., "Seems like an ad"). Character counter shows count. Stops at 150.
- [ ] Tap Submit. Modal closes. Toast: "Thanks for your report. Our team will review it."
- [ ] Verify in Supabase dashboard: row in `reports` with correct reporter_id, target_type = 'post', target_id, reason, note, status = 'pending'.

### Report post from GroupCard:

- [ ] Same flow on a GroupCard in the feed. ⋯ menu → Report → modal → submit.

### Report post from post detail page:

- [ ] Navigate to /post/[P1 ID]. ⋯ menu → Report → same flow works.

### Report user from profile:

- [ ] Navigate to /profile/[User C ID]. ⋯ menu → "Report this user."
- [ ] Same modal with same reason options.
- [ ] Submit. Verify in Supabase: target_type = 'user', target_id = User C's ID.

### Anonymity:

- [ ] After reporting, sign in as User A (reported post's author). Navigate to their own profile and posts.
- [ ] Verify: no notification received. No indication anywhere that they've been reported.
- [ ] Sign in as User C (reported user). Same — no notification, no indication.

### Self-report prevention:

- [ ] View your own post in the feed. ⋯ menu either missing "Report" or it's not there.
- [ ] View your own profile. ⋯ menu either not shown or "Report this user" not in it.

### Unauthenticated:

- [ ] Open incognito. Navigate to /post/[P1 ID] (deep link preview).
- [ ] Verify: ⋯ menu NOT shown on the post preview.

### Error handling:

- [ ] Disconnect network (DevTools > Network > Offline). Attempt to submit a report.
- [ ] Error toast shown. Modal stays open with selections preserved.
- [ ] Re-enable network. Submit again. Report succeeds.

### Mobile UX:

- [ ] Bottom sheet modal renders correctly on 390px viewport — no content cut off.
- [ ] Radio buttons are tappable (44px minimum touch target per option).
- [ ] Note textarea doesn't cause keyboard overlap issues on iOS.
- [ ] ⋯ menu touch target is minimum 44px.
- [ ] Modal is dismissable by tapping outside and by close button.
- [ ] No horizontal scroll on any Phase 9 surface.

---

## Summary of deliverables

After completing all seven passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files in `/src/__tests__/`:
   - `report-post.test.tsx`
   - `report-user.test.tsx`
   - `report-security.test.ts`
   - `report-edge-cases.test.ts`
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. Manual verification checklist completed with all items checked.

Phase 9 is intentionally small because the actioning side (admin reviewing and acting on reports) is built in Phase 10. This eval confirms the submission pipeline is correct, anonymous, and secure. Phase 10's eval will test the admin review queue end-to-end.
