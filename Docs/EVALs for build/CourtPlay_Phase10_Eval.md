# CourtPlay — Phase 10 Eval: Admin Dashboard

## How to use this eval

Run this prompt in Claude Code after Phase 10 is complete. Phase 10 is the largest single-phase build — six CRUD panels and an analytics dashboard, all behind a security boundary. The admin dashboard is the operational backbone of CourtPlay: every moderation action, dispute resolution, and data review happens here.

The eval has nine passes:

1. **Code quality & security audit** — Access control, RLS enforcement, route protection.
2. **Posts panel tests** — View, edit, soft-delete, force-expire.
3. **Users panel tests** — View, suspend, delete, reset password, admin grant/revoke.
4. **Claims panel tests** — View, cancel, responsiveness log.
5. **Courts panel tests** — CRUD on master list, custom court alert queue.
6. **Reports panel tests** — Queue, dismiss, remove content, escalate.
7. **Analytics dashboard tests** — Metrics, funnel, counts.
8. **Cross-panel integration tests** — Actions that span multiple panels.
9. **Manual verification** — Full checklist.

Work through each pass sequentially. Fix issues before proceeding.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phases 3–9 evals pass completely.
4. Supabase database has the full schema with admin RLS policies on all tables: `users`, `posts`, `claims`, `reports`, `courts`, `custom_court_submissions`, `responsiveness_log`, `notifications`.
5. Test data:

   | Entity | Details |
   |---|---|
   | **Admin A** | `is_admin = true`. Primary test admin. |
   | **Admin B** | `is_admin = true`. Second admin for grant/revoke testing. |
   | **User C** | Regular user. `is_admin = false`. Has 3 posts, 2 claims. |
   | **User D** | Regular user. Has been reported twice (2 rows in `reports`). |
   | **User E** | Suspended user. `is_suspended = true`. |
   | **User F** | Soft-deleted user. `deleted_at` set. |
   | **Post P1** | Active sub_need by User C. Has 1 pending claim by User D. |
   | **Post P2** | Active sub_need by User C. Has 1 approved claim by User D. |
   | **Post P3** | Expired sub_need by User C. |
   | **Post P4** | Deleted sub_need by User C. `deleted_at` set, `deleted_by` = User C. |
   | **Claim CL1** | Pending claim by User D on Post P1. Created 15h ago (has responsiveness_log entry). |
   | **Claim CL2** | Approved claim by User D on Post P2. |
   | **Report R1** | Against Post P1. Reason = 'spam'. Status = 'pending'. |
   | **Report R2** | Against User D. Reason = 'inappropriate'. Status = 'pending'. |
   | **Report R3** | Against Post P3. Status = 'dismissed' (already actioned). |
   | **Court 1, 2, 3** | Active courts in master list. |
   | **Custom court sub** | "Backyard Tennis" submitted 4 times (`submission_count = 4`, `alerted = true`). |
   | **Responsiveness entry** | For User C on Post P1/Claim CL1. `event_type = 'responded'`, `response_time_hours = 2.5`. |

---

## Pass 1 — Code quality & security audit

### 1.1 File structure compliance

```
/src/pages/Admin/index.tsx       (admin layout with sidebar)
/src/pages/Admin/Posts.tsx
/src/pages/Admin/Users.tsx
/src/pages/Admin/Claims.tsx
/src/pages/Admin/Courts.tsx
/src/pages/Admin/Reports.tsx
/src/pages/Admin/Analytics.tsx
/src/components/layout/AdminLayout.tsx  (sidebar + content)
```

### 1.2 Route-level access control — CRITICAL

This is the highest-priority check. Per implementation note #7:

> The `/admin` route must check `is_admin` via a fresh Supabase query on every load — not from cached state. A compromised JWT should not be able to access admin.

- [ ] The `/admin` route and all sub-routes are protected by a guard that queries `select is_admin from users where id = auth.uid()` on every page load or route transition.
- [ ] The admin check does NOT rely on: cached React state, localStorage, sessionStorage, JWT claims, or a Context value set at login time.
- [ ] The query is a fresh Supabase call each time — if the admin flag is revoked between page loads, the next load must redirect to `/feed`.
- [ ] Non-admin users navigating to `/admin` are immediately redirected to `/feed`. No flash of admin content before redirect.
- [ ] Unauthenticated users navigating to `/admin` are redirected to `/signin`.
- [ ] The admin check runs before any data is fetched for the admin panels — no admin-only queries fire until `is_admin` is confirmed.

### 1.3 RLS enforcement

Admin panels rely on admin RLS policies (`for all using (exists(...is_admin...))`) on every table. Verify:

- [ ] Admin can read ALL posts (active, expired, deleted) — the regular user policy filters `status = 'active'`, but the admin policy uses `for all` which overrides.
- [ ] Admin can read ALL users (including suspended and soft-deleted) — the regular user policy filters `deleted_at is null and is_suspended = false`, but the admin policy overrides.
- [ ] Admin can read ALL claims regardless of ownership.
- [ ] Admin can read ALL reports.
- [ ] Admin can read responsiveness_log.
- [ ] Admin can write to courts and custom_court_submissions.
- [ ] A non-admin user with a manipulated frontend (e.g., DevTools editing) cannot call admin queries — RLS blocks at the database level.

### 1.4 TypeScript quality

- [ ] No `any` types in admin code.
- [ ] All table data is typed with interfaces matching the database schema.
- [ ] Pagination parameters are typed: `{ page: number, pageSize: number }`.
- [ ] Filter parameters are typed per panel (e.g., `PostFilters = { status?: string, format?: string, ... }`).
- [ ] Admin action results are typed (e.g., soft-delete returns updated row, suspend returns updated user).

### 1.5 Audit logging

The spec says: "All admin edits logged with `deleted_by` / timestamp."

- [ ] Admin soft-delete of a post sets `deleted_by = admin's user ID` and `deleted_at = now()`. Verify `deleted_by` is the admin, not the original poster.
- [ ] Admin edits to posts are traceable — either via a dedicated `admin_audit_log` table or by using `deleted_by`/timestamp fields. If no audit log table exists, verify at minimum that admin actions update `deleted_by` where applicable and that the admin's ID is recorded.
- [ ] Admin suspension of a user is traceable — at minimum the `is_suspended` toggle is timestamped (if no audit table, note as a V1.5 improvement).

### 1.6 React best practices

- [ ] All admin tables use pagination — not loading all rows at once. Page size should be reasonable (20–50 rows).
- [ ] Tables show a loading state while data fetches.
- [ ] Tables show an empty state when no rows match current filters.
- [ ] Destructive actions (soft-delete, suspend, force-expire, cancel claim) require a confirmation modal.
- [ ] All async operations show loading states on their trigger buttons.
- [ ] All errors show error toasts with retry options.
- [ ] Sidebar navigation highlights the active section.

### 1.7 Design tokens

- [ ] Admin layout uses the same token palette as the rest of the app — no separate admin color scheme.
- [ ] Table rows for deleted/expired/suspended items use subtle visual differentiation (e.g., `--color-text-tertiary` for text, `--color-background-secondary` for row background).
- [ ] Action buttons use `--color-primary` for safe actions, `--color-red` for destructive actions (delete, suspend).

---

## Pass 2 — Posts panel tests

Create `/src/__tests__/admin-posts.test.tsx`.

```
Test: "posts table shows all posts including active, expired, and deleted"
  - Sign in as Admin A
  - Assert: Post P1 (active), P3 (expired), P4 (deleted) all visible in the table

Test: "posts table is paginated"
  - Assert: pagination controls visible (next, previous, page count)
  - Assert: page size is 20–50 rows

Test: "filter by status works"
  - Select status filter = 'active'
  - Assert: only active posts visible
  - Select status filter = 'deleted'
  - Assert: only deleted posts visible

Test: "filter by format works"
  - Select format filter = 'point_play'
  - Assert: only point_play posts visible

Test: "filter by user works"
  - Filter by User C
  - Assert: only User C's posts visible

Test: "filter by date range works"
  - Select date range covering only tomorrow
  - Assert: only posts with game_date = tomorrow visible

Test: "admin can view full post details"
  - Click View on Post P1
  - Assert: all post fields visible including author, claims, view count

Test: "admin can edit any field on a post"
  - Click Edit on Post P1
  - Change skill_level from '3.5' to '4.0'
  - Save
  - Assert: post updated in database with new skill_level

Test: "admin edit is logged"
  - After editing Post P1
  - Assert: some audit trail exists — at minimum check that the post was updated by the admin (if using a dedicated audit log, verify the entry; if not, note as V1.5 improvement)

Test: "admin can soft-delete a post"
  - Click Soft-delete on Post P1
  - Confirmation modal shown
  - Confirm
  - Assert: posts.status = 'deleted', deleted_at set, deleted_by = Admin A's ID

Test: "admin soft-delete notifies pending and approved claimers"
  - Post P1 has pending claim by User D
  - Admin soft-deletes P1
  - Assert: send-notification called for User D

Test: "admin soft-delete does NOT notify rejected/unclaimed claimers"
  - Post has a rejected claim
  - Assert: rejected claimer NOT notified

Test: "admin can force-expire a post"
  - Click Force-expire on Post P2 (active, game is future)
  - Assert: posts.status = 'expired'
  - Assert: post disappears from user-facing feed

Test: "admin cannot hard-delete a post"
  - Assert: no "Permanently delete" or "Hard delete" option anywhere in the UI
  - Assert: no DELETE FROM posts query in the admin code
```

---

## Pass 3 — Users panel tests

Create `/src/__tests__/admin-users.test.tsx`.

```
Test: "users table shows all users including suspended and deleted"
  - Sign in as Admin A
  - Assert: User C (active), User E (suspended), User F (deleted) all visible

Test: "users table shows profile details, join date, post count, claim count, report count"
  - Assert: User C row shows post count = 3, claim count = 2
  - Assert: User D row shows report count = 2

Test: "filter by status works"
  - Filter by status = 'suspended'
  - Assert: only User E visible

Test: "filter by join date works"
  - Assert: date range filter functions correctly

Test: "filter by report count works"
  - Filter by report count >= 2
  - Assert: only User D visible

Test: "admin can view user's full profile"
  - Click View on User C
  - Assert: all profile fields visible (including admin-only fields like is_admin, is_suspended)

Test: "admin can view user's post, claim, and report history"
  - Click View on User D
  - Assert: User D's claims visible
  - Assert: reports against User D visible

Test: "admin can suspend a user"
  - Click Suspend on User C
  - Confirmation modal shown
  - Confirm
  - Assert: users.is_suspended = true

Test: "suspended user sees login blocked message"
  - Sign in as User C (now suspended) in another browser
  - Assert: login blocked with message "Your account has been suspended. Contact support."

Test: "admin can unsuspend a user"
  - Click Unsuspend on User E (currently suspended)
  - Assert: users.is_suspended = false
  - Assert: User E can sign in again

Test: "admin can soft-delete a user"
  - Click Delete on User C
  - Confirmation modal shown
  - Confirm
  - Assert: users.deleted_at set
  - Assert: personal data anonymized (first_name, headline cleared or set to generic values)
  - Assert: post and claim history preserved (rows still exist, author_id still links)

Test: "admin can trigger password reset"
  - Click Reset Password on User C
  - Assert: Supabase auth.admin.generateLink or equivalent called for User C's email
  - Assert: confirmation toast shown

Test: "admin can grant admin access"
  - Admin A grants admin to User C: toggle is_admin = true
  - Assert: users.is_admin = true for User C

Test: "admin can revoke admin access"
  - Admin A revokes admin from Admin B: toggle is_admin = false
  - Assert: users.is_admin = false for Admin B

Test: "is_admin toggle only visible to existing admins"
  - Sign in as Admin A
  - Assert: is_admin toggle visible on user rows
  - (Non-admins can't access admin panel at all, so this is really about verifying the toggle exists)

Test: "admin cannot delete themselves"
  - Admin A attempts to soft-delete their own account from the admin panel
  - Assert: action blocked or not available — an admin deleting themselves could lock out admin access

Test: "admin cannot revoke their own admin if they're the last admin"
  - If Admin A is the only admin, attempt to revoke own is_admin
  - Assert: blocked with message (e.g., "Cannot remove the last admin") or at minimum a confirmation warning
```

---

## Pass 4 — Claims panel tests

Create `/src/__tests__/admin-claims.test.tsx`.

```
Test: "claims table shows all claims"
  - Sign in as Admin A
  - Assert: CL1 (pending), CL2 (approved) both visible

Test: "claims table filterable by status"
  - Filter by status = 'pending'
  - Assert: only CL1 visible

Test: "claims table filterable by user"
  - Filter by claimer = User D
  - Assert: CL1 and CL2 visible (both by User D)

Test: "claims table filterable by date"
  - Assert: date range filter works on created_at

Test: "admin can cancel a claim"
  - Click Cancel on CL1 (pending)
  - Confirmation modal shown
  - Confirm
  - Assert: claims.status = 'cancelled'
  - Assert: claims.resolved_at set

Test: "admin claim cancellation notifies both parties"
  - Cancel CL1 (User D's claim on User C's post)
  - Assert: send-notification called for User D (claimer)
  - Assert: send-notification called for User C (poster)

Test: "admin can cancel an approved claim"
  - Cancel CL2 (approved)
  - Assert: claims.status = 'cancelled'
  - Assert: both parties notified

Test: "admin can view responsiveness_log for a poster"
  - Click on User C's responsiveness data (or navigate via user detail)
  - Assert: responsiveness_log entries visible for User C
  - Assert: shows event_type = 'responded', response_time_hours = 2.5 for the test entry

Test: "responsiveness log data is read-only"
  - Assert: no edit or delete actions on responsiveness_log entries
```

---

## Pass 5 — Courts panel tests

Create `/src/__tests__/admin-courts.test.tsx`.

```
Test: "courts panel shows master court list"
  - Sign in as Admin A
  - Assert: Court 1, 2, 3 all visible

Test: "admin can add a new court"
  - Enter name "Weston Racquet Club", area "Weston"
  - Save
  - Assert: new row in courts table with active = true
  - Assert: court immediately available in post creation court dropdown (verify via user-facing query)

Test: "admin can edit a court name"
  - Edit Court 1's name
  - Save
  - Assert: court name updated in database
  - Assert: existing posts retain their original stored court name (posts reference court_id, so the join will show the new name — verify this is the intended behavior)

Test: "admin can deactivate a court"
  - Click Deactivate on Court 3
  - Assert: courts.active = false
  - Assert: Court 3 no longer appears in user-facing court dropdown
  - Assert: existing posts that reference Court 3 still display correctly (the court row still exists, just inactive)

Test: "admin can reactivate a deactivated court"
  - Reactivate Court 3
  - Assert: courts.active = true
  - Assert: Court 3 reappears in user-facing dropdown

Test: "custom court submissions alert queue shows pending alerts"
  - "Backyard Tennis" has submission_count = 4, alerted = true
  - Assert: visible in the custom court alert queue

Test: "admin can add custom court to master list"
  - Click "Add to master list" on "Backyard Tennis" alert
  - Assert: new row in courts table with name "Backyard Tennis", active = true
  - Assert: alert dismissed (removed from queue or marked as handled)

Test: "admin can dismiss custom court alert without adding"
  - Click Dismiss on a custom court alert
  - Assert: alert removed from queue
  - Assert: no new court added to master list

Test: "custom court alerts only show submissions with count >= 3"
  - A custom court with submission_count = 2 exists
  - Assert: NOT shown in the alert queue
```

---

## Pass 6 — Reports panel tests

Create `/src/__tests__/admin-reports.test.tsx`.

```
Test: "reports panel shows pending reports"
  - Sign in as Admin A
  - Assert: Report R1 (pending, against post) and R2 (pending, against user) visible
  - Assert: Report R3 (dismissed) either not shown or in a separate "resolved" section

Test: "report shows target context — post preview for post reports"
  - Report R1 targets Post P1
  - Assert: post preview visible (format, date, cost, poster name)

Test: "report shows target context — user profile for user reports"
  - Report R2 targets User D
  - Assert: user profile summary visible (name, skill level)

Test: "report shows reporter note and timestamp"
  - Assert: reporter's note visible
  - Assert: created_at timestamp visible

Test: "report does NOT show reporter identity to anyone in the admin panel"
  - Assert: reporter_id is NOT displayed anywhere in the reports panel UI
  - (Admins can query the database directly to find reporter_id, but the admin UI should not expose it — this preserves anonymity as a default even for admin users)
  - NOTE: If you intentionally want admins to see reporter_id, this is a product decision. Verify with the product owner and document the decision. For V1, the spec says "Reporter remains anonymous" without specifying an admin exemption.

Test: "admin can dismiss a report"
  - Click Dismiss on Report R1
  - Assert: reports.status = 'dismissed'
  - Assert: reports.reviewed_by = Admin A's ID
  - Assert: reports.reviewed_at set
  - Assert: no notification sent to anyone

Test: "admin can remove content — soft-delete a reported post"
  - Click "Remove content" on Report R1 (targets Post P1)
  - Assert: reports.status = 'actioned'
  - Assert: reports.reviewed_by = Admin A's ID
  - Assert: Post P1 soft-deleted (status = 'deleted', deleted_at set, deleted_by = Admin A's ID)
  - Assert: notification sent to Post P1's author (User C): "Your post was removed for violating community guidelines."

Test: "admin can remove content — suspend a reported user"
  - Click "Remove content" on Report R2 (targets User D)
  - Assert: reports.status = 'actioned'
  - Assert: User D's is_suspended = true
  - Assert: notification sent to User D about suspension (or no notification — verify which approach the spec intends; the product plan says "If action taken: 'Your post was removed for violating community guidelines'" which covers posts but is ambiguous for user suspensions)

Test: "admin can escalate a report"
  - Click Escalate on a pending report
  - Assert: report flagged for further review (either a status change to 'escalated' or a visual indicator — the spec says "flag for further review" without defining how, so verify the implementation choice)

Test: "actioning a report against a post does not affect other reports against the same post"
  - Post P1 has Report R1. A second report R4 also targets Post P1.
  - Dismiss R1
  - Assert: R4 still pending and visible

Test: "removed post notification uses correct copy"
  - Remove a post via report actioning
  - Assert: notification to post author contains "Your post was removed for violating community guidelines"
  - Assert: notification does NOT mention the reporter or the report reason
```

---

## Pass 7 — Analytics dashboard tests

Create `/src/__tests__/admin-analytics.test.tsx`.

```
Test: "key metrics cards render with correct values"
  - Assert visible: total users count (matching users table count excluding soft-deleted)
  - Assert visible: active users (last 7 days) — users who created a post or claim in the last 7 days
  - Assert visible: posts created (last 7 days)
  - Assert visible: successful matches (approved claims, last 7 days)
  - Assert visible: push opt-in rate (users with onesignal_player_id / total users)

Test: "funnel table shows correct conversion steps"
  - Assert: funnel shows sign-ups count
  - Assert: funnel shows profile complete count (users with required fields filled)
  - Assert: funnel shows first follow count
  - Assert: funnel shows first post or claim count
  - Assert: funnel shows first match (approved claim) count
  - Assert: each step count <= the step before it (funnel narrows)

Test: "recent report activity count shown"
  - Assert: count of reports submitted in last 7 days visible

Test: "custom court submission alert count shown"
  - Assert: count of pending custom court alerts (submission_count >= 3) visible

Test: "analytics handle zero data gracefully"
  - In a fresh database with no activity
  - Assert: all metrics show 0, no errors, no NaN, no blank cards

Test: "analytics load with loading state"
  - Assert: skeleton or spinner shown while metrics queries run
  - Assert: metrics appear after loading

Test: "email open rate shows data or N/A"
  - If Resend webhooks are configured: assert open rate percentage shown
  - If not configured: assert "N/A" or "Not configured" — not an error
```

---

## Pass 8 — Cross-panel integration tests

Create `/src/__tests__/admin-integration.test.ts`.

```
Test: "suspending a user from Users panel is reflected in Posts panel"
  - Suspend User C from Users panel
  - Navigate to Posts panel
  - Assert: User C's posts are still visible (suspended users' content remains)
  - Assert: User C's row in Users panel shows suspended state

Test: "soft-deleting a post from Posts panel updates claims in Claims panel"
  - Soft-delete Post P1 from Posts panel
  - Navigate to Claims panel
  - Assert: CL1 (claim on P1) shows the post as deleted in its context

Test: "actioning a report from Reports panel reflects in Posts/Users panels"
  - Remove content on Report R1 (soft-delete Post P1) from Reports panel
  - Navigate to Posts panel
  - Assert: Post P1 shows status = 'deleted'

Test: "adding a court from Courts panel makes it available in post creation"
  - Add a new court "Greenwich Tennis Club"
  - Sign in as User C in another tab, create a new post
  - Assert: "Greenwich Tennis Club" appears in the court dropdown

Test: "deactivating a court does not break existing posts referencing it"
  - Post P1 references Court 1
  - Deactivate Court 1 from Courts panel
  - Assert: Post P1 still displays "Court 1" name in the feed and admin panel
  - Assert: Court 1 no longer available for new posts

Test: "admin claim cancellation updates spot count on the post"
  - Cancel CL2 (approved claim on Post P2)
  - Assert: Post P2's spots_available increases by 1
  - Assert: Post P2 re-appears as claimable in the feed (if it was full before)
```

---

## Pass 9 — Access control stress tests

Create `/src/__tests__/admin-access-control.test.ts`.

```
Test: "non-admin user redirected from /admin to /feed"
  - Sign in as User C (is_admin = false)
  - Navigate to /admin
  - Assert: redirected to /feed immediately

Test: "non-admin user redirected from /admin/posts to /feed"
  - Navigate directly to /admin/posts
  - Assert: redirected to /feed

Test: "non-admin user redirected from /admin/users to /feed"
  - Assert: redirected

Test: "unauthenticated user redirected from /admin to /signin"
  - No auth session
  - Navigate to /admin
  - Assert: redirected to /signin

Test: "admin check is fresh on every load — not cached"
  - Sign in as Admin A, navigate to /admin — works
  - In Supabase dashboard, set Admin A's is_admin = false
  - Navigate to another admin sub-route (e.g., /admin/users)
  - Assert: redirected to /feed (the fresh query catches the revocation)

Test: "revoking admin mid-session blocks further admin access"
  - Admin A is on /admin/posts
  - Admin B revokes Admin A's admin status
  - Admin A navigates to /admin/users
  - Assert: redirected to /feed

Test: "admin data queries fail for non-admin even with manipulated frontend"
  - Sign in as User C
  - Use browser DevTools to manually call a Supabase query: select * from reports
  - Assert: RLS blocks — returns empty or error

Test: "admin data queries fail for non-admin on users table"
  - Sign in as User C
  - Query: select * from users where is_suspended = true
  - Assert: returns empty (regular user RLS filters suspended users)

Test: "admin data queries fail for non-admin on responsiveness_log"
  - Sign in as User C
  - Query: select * from responsiveness_log
  - Assert: returns empty (only admin select policy exists)
```

---

## Pass 10 — Run tests and fix

1. Run all tests: `npx vitest run`
2. Fix code (not tests) for any failures.
3. After all tests pass, run `npm run build` to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time.

---

## Pass 11 — Manual verification checklist

Run the app locally (`npm run dev`). Use two browser windows — one as Admin A, one as a regular user.

### Access control:

- [ ] Sign in as User C (non-admin). Navigate to /admin. Redirected to /feed.
- [ ] Sign in as Admin A. Navigate to /admin. Dashboard loads.
- [ ] Sidebar shows: Posts, Users, Claims, Courts, Reports, Analytics.

### Posts panel:

- [ ] Table shows all posts (active, expired, deleted) with pagination.
- [ ] Filters work: status, date, user, format.
- [ ] Click View on a post — full details shown.
- [ ] Click Edit — change a field, save. Verify update in Supabase.
- [ ] Click Soft-delete — confirmation modal. Confirm. Post status = 'deleted'. Verify `deleted_by` = admin's ID.
- [ ] Soft-deleted post disappears from user-facing feed (check other browser as User C).
- [ ] Click Force-expire — post status = 'expired'.
- [ ] No hard-delete option exists anywhere.

### Users panel:

- [ ] Table shows all users including suspended and deleted.
- [ ] Table shows post count, claim count, report count per user.
- [ ] Filters work: status, join date, report count.
- [ ] Click View — full profile with post/claim/report history.
- [ ] Click Suspend on User C — confirmation. `is_suspended = true`. In other browser, User C's login is blocked.
- [ ] Click Unsuspend — `is_suspended = false`. User C can sign in again.
- [ ] Click Delete — soft delete with anonymization. Verify in Supabase: `deleted_at` set, personal data cleared.
- [ ] Click Reset Password — confirmation toast. (Verify Supabase auth logs show reset email triggered.)
- [ ] Toggle is_admin on User C — verify `is_admin` changes.
- [ ] Toggle is_admin off Admin B — verify Admin B can no longer access /admin.

### Claims panel:

- [ ] Table shows all claims with filters.
- [ ] Click Cancel on CL1 — confirmation modal. Status = 'cancelled'. Both User C and User D notified.
- [ ] Responsiveness log for User C visible (shows response time and event type).

### Courts panel:

- [ ] Master court list visible.
- [ ] Add a new court — appears in the list and in user-facing court dropdown.
- [ ] Edit a court name — updated.
- [ ] Deactivate a court — no longer in user-facing dropdown, existing posts unaffected.
- [ ] Custom court alert queue shows "Backyard Tennis" (count >= 3).
- [ ] "Add to master list" — creates a new court.
- [ ] "Dismiss" — removes alert from queue.

### Reports panel:

- [ ] Pending reports shown with target preview and reporter note.
- [ ] Reporter identity NOT displayed in the UI.
- [ ] Dismiss a report — status = 'dismissed', reviewed_by and reviewed_at set.
- [ ] Remove content on a post report — post soft-deleted, author notified with community guidelines message.
- [ ] Remove content on a user report — user suspended.
- [ ] Escalate a report — flagged for further review.

### Analytics:

- [ ] Key metrics cards load: total users, active users, posts created, matches, push opt-in rate.
- [ ] Funnel table shows conversion steps with narrowing counts.
- [ ] Report activity count visible.
- [ ] Custom court alert count visible.
- [ ] No NaN, undefined, or error states on any metric card.

### Mobile / responsive:

- [ ] Admin dashboard is usable at 1024px+ (it's an admin tool, not required at 390px mobile, but should not break).
- [ ] If accessed on mobile, sidebar collapses or scrolls without breaking layout.
- [ ] Tables scroll horizontally if columns exceed viewport width.
- [ ] All confirmation modals render correctly.

---

## Summary of deliverables

After completing all eleven passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files in `/src/__tests__/`:
   - `admin-posts.test.tsx`
   - `admin-users.test.tsx`
   - `admin-claims.test.tsx`
   - `admin-courts.test.tsx`
   - `admin-reports.test.tsx`
   - `admin-analytics.test.tsx`
   - `admin-integration.test.ts`
   - `admin-access-control.test.ts`
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. Manual verification checklist completed with all items checked.

Phase 10 is the most panel-heavy phase but the patterns are repetitive (paginated table + filters + CRUD actions). The highest-risk items are the access control checks (Pass 9) and the report actioning flow (Pass 6) — these are the places where bugs have real safety consequences.
