# CourtPlay — Phase 7 Eval: Notifications

## How to use this eval

Run this prompt in Claude Code after Phase 7 is complete. Phase 7 is the most infrastructure-heavy phase in CourtPlay V1 — it spans frontend UI (preferences, push permission prompts), backend logic (dispatch function, two Edge Functions), four scheduled cron jobs, and two external service integrations (OneSignal, Resend). Every subsequent phase depends on the notification dispatch function working correctly.

The eval has seven passes:

1. **Code quality audit** — Review all Phase 7 code for correctness, security, and architecture.
2. **Notification dispatch function tests** — The central routing logic.
3. **Notification preferences UI tests** — Settings screen toggles and defaults.
4. **Event-driven trigger tests** — All inline notification triggers from claim and post actions.
5. **Scheduled cron job tests** — 12h nudge, 48h unfilled, game reminder, friend expiry alert.
6. **Edge Function integration tests** — Direct curl invocation of each Edge Function.
7. **Manual verification** — Visual/UX checklist plus real notification delivery checks.

Work through each pass sequentially. Fix issues before proceeding.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phases 3–6 evals pass completely.
4. Supabase database has the full schema applied, including:
   - `notifications` table
   - `notification_preferences` table with `unique(user_id, notification_type)` constraint
   - All RLS policies for both tables
   - `post_views` table (needed for price drop notifications)
   - `notify_me` table (needed for spot reopened notifications)
5. External services configured:
   - **OneSignal:** App created, app ID set in `VITE_ONESIGNAL_APP_ID` env var. OneSignal SDK initialized.
   - **Resend:** API key set in `RESEND_API_KEY` (Supabase Edge Function secret, not frontend env var). Sending domain verified or using Resend sandbox.
6. Supabase Edge Functions deployed:
   - `send-notification`
   - `send-email`
   - `nudge-unresponded-claims`
   - `friend-expiry-alerts`
   - `48h-unfilled-nudge`
   - `game-reminders`
7. `pg_cron` extension enabled in Supabase.
8. Test data:

   | Entity | Details |
   |---|---|
   | **User A** (poster) | Has `onesignal_player_id` set. Push enabled for all types. Email enabled. 2 active posts. |
   | **User B** (claimer) | Has `onesignal_player_id` set. Push enabled for claim_approved only. Email enabled for all. |
   | **User C** (follower) | Follows User A. Push and email enabled for friend alerts. |
   | **User D** (quiet user) | Push disabled for all types. Email enabled for all types. No `onesignal_player_id`. |
   | **Post P1** | By User A. Active sub_need. Game date = tomorrow. 1 spot open. |
   | **Post P2** | By User A. Active sub_need. Game date = today, game_time = 5 hours from now. 1 spot open. No claims. (For friend expiry alert testing.) |
   | **Post P3** | By User A. Active sub_need. Created 49 hours ago. Game date = 2 days from now. No claims. (For 48h nudge testing.) |
   | **Post P4** | By User A. Active sub_need. Game date = tomorrow. Has 1 pending claim by User B, created 13 hours ago. (For 12h nudge testing.) |
   | **Post P5** | By User A. Active sub_need. Game date = day after tomorrow. Has 1 approved claim by User B. (For game reminder testing.) |
   | **Claim C1** | User B's pending claim on Post P4, created 13 hours ago. |

---

## Reference: Notification type matrix

Every test in this eval references this matrix. A notification trigger that is missing from this matrix should not exist in the code.

| # | Trigger | Recipient | Default channels | Data payload |
|---|---|---|---|---|
| N1 | Claim submitted | Poster | Push + email | claimer name, post summary |
| N2 | Claim approved | Claimer | Push + email | poster name, Venmo deep link, post summary |
| N3 | Claim rejected | Claimer | Push + email | optional rejection reason, post summary |
| N4 | Claimer backed out | Poster | Push + email | claimer name, post summary |
| N5 | Cost changed on claimed post | Pending + approved claimers | Push + email | old cost, new cost, back-out option |
| N6 | 12h nudge — claim unresponded | Poster + claimer (simultaneous) | Push + email | claim summary, action prompts |
| N7 | Claimer cancels pending claim | Poster | Push + email | claimer name, post summary |
| N8 | Price drop on post you viewed | Prior viewers | Push only | old cost, new cost, post summary |
| N9 | Spot reopened (Notify me) | Watchers | Per preference | post summary |
| N10 | 48h — spot unfilled | Poster | Push only | post summary, discount suggestion |
| N11 | Game reminder (day before) | Poster + approved claimer | Push only | game date, time, location |
| N12 | Friend's unfilled spot — 4h before game | Followers of poster | Push + email | "[Name]'s spot at [Location] is still open — game starts in 4 hours." |
| N13 | Friend posts new sub need | Followers of poster | Push only (opt-in) | Off by default |

---

## Pass 1 — Code quality audit

### 1.1 File structure compliance

Verify the following files exist:

```
/src/supabase/functions/send-notification/index.ts
/src/supabase/functions/send-email/index.ts
/src/supabase/functions/nudge-unresponded-claims/index.ts
/src/supabase/functions/friend-expiry-alerts/index.ts
/src/supabase/functions/48h-unfilled-nudge/index.ts
/src/supabase/functions/game-reminders/index.ts
/src/hooks/useNotifications.ts
/src/components/app/NotificationPreferences.tsx  (or in Settings page)
```

Email templates (HTML files or template strings) should exist for each notification type — verify there is a distinct template or template branch for at minimum: N1–N7 and N12. N8, N10, N11, N13 are push-only and don't need email templates.

### 1.2 TypeScript quality

- [ ] A `NotificationType` union type exists covering all 13 notification types from the matrix above (e.g., `'claim_submitted' | 'claim_approved' | 'claim_rejected' | ...`). No raw strings passed where this union should be used.
- [ ] A `NotificationChannel` union type: `'push' | 'email'`. SMS is excluded from V1 — verify `'sms'` is never dispatched.
- [ ] The `send-notification` Edge Function input is typed: `{ user_id: string, notification_type: NotificationType, data: Record<string, unknown> }`.
- [ ] The `send-email` Edge Function input is typed: `{ to: string, subject: string, html: string }`.
- [ ] All cron job Edge Functions have typed query results for the posts and claims they fetch.
- [ ] No `any` types in any Edge Function or notification-related frontend code.

### 1.3 Dispatch function architecture

The `send-notification` Edge Function is the central routing layer. Verify:

- [ ] It accepts `{ user_id, notification_type, data }`.
- [ ] It queries `notification_preferences` for the user and notification type.
- [ ] **If push enabled AND `onesignal_player_id` is set:** calls OneSignal REST API to send push.
- [ ] **If push enabled BUT `onesignal_player_id` is null:** does NOT attempt to send push (no OneSignal error), falls back silently to email only.
- [ ] **If email enabled:** calls the `send-email` Edge Function with the correct template.
- [ ] **If neither channel enabled:** logs the notification as `'skipped'` or does not insert into `notifications` table. Does NOT error.
- [ ] After dispatching, inserts a row into the `notifications` table for each channel actually sent.
- [ ] The dispatch function uses the **service role key** (not the anon key) — it must bypass RLS to read other users' preferences and insert notifications on their behalf.
- [ ] The dispatch function never exposes the service role key to the frontend.

### 1.4 OneSignal integration

- [ ] OneSignal initialized in `main.tsx` or app root with `VITE_ONESIGNAL_APP_ID`.
- [ ] On first push opt-in, the OneSignal player ID is stored on the user's Supabase row (`onesignal_player_id` column). Verify this uses an authenticated Supabase update call.
- [ ] Push permission is requested contextually, NOT on first page load:
  - (a) After user creates their first post.
  - (b) After user views a post without claiming — show inline prompt: "Get notified when prices drop or new spots open at your skill level."
- [ ] The inline push prompt is dismissable and does not re-appear after dismissal (store dismissal in localStorage or user preferences).
- [ ] OneSignal REST API call in `send-notification` uses the OneSignal REST API key stored as a Supabase secret — not in the frontend bundle.
- [ ] Push notification payload includes: title, body text, and a deep link URL (`https://courtplay.com/post/[id]` or `/activity` depending on notification type).

### 1.5 Resend integration

- [ ] `send-email` Edge Function calls Resend API with `RESEND_API_KEY` from Supabase secrets.
- [ ] From address uses the CourtPlay domain (e.g., `notifications@courtplay.com`) or Resend sandbox address.
- [ ] Email HTML templates are mobile-responsive (single-column, max 600px, readable on mobile email clients).
- [ ] Email subject lines are descriptive and include the relevant context (e.g., "Someone claimed your spot at Longshore Club" not just "CourtPlay notification").
- [ ] Email body includes: notification content, a CTA link to the relevant screen (post detail or My Activity), and an unsubscribe/preferences link.
- [ ] Emails do NOT contain: raw HTML tags in the body, unescaped user input, Venmo handles or phone numbers (except in the claim_approved email to the claimer where it's spec'd).

### 1.6 No SMS in V1

- [ ] The `sms_enabled` column exists in `notification_preferences` but is always `false`.
- [ ] The `send-notification` function does NOT have any Twilio code, Twilio imports, or SMS sending logic.
- [ ] The notification preferences UI shows the SMS column as disabled/grayed out with a "Coming soon" label, or does not show it at all.
- [ ] No `'sms'` channel value is ever inserted into the `notifications` table.

### 1.7 Email fallback logic

Per the product plan: "If a user has not opted into push, email is the fallback for all notifications."

- [ ] For notification types where push is the default channel (N8, N10, N11, N13): if the user does not have push enabled, the dispatch function falls back to email.
- [ ] The fallback is NOT hardcoded per notification type — it respects the user's preferences. If a user has explicitly disabled email for a type, the fallback does not override that.
- [ ] Fallback logic: if push_enabled = false for this type, check email_enabled. If email_enabled = true, send email. If both false, skip.

### 1.8 Security

- [ ] All Edge Functions validate the `Authorization` header — they must only accept requests with a valid service role key or a valid user JWT (depending on the function).
- [ ] The `send-notification` and `send-email` functions accept the service role key only — they cannot be called directly from the frontend with an anon key.
- [ ] Cron job HTTP calls include the service role key in the Authorization header.
- [ ] OneSignal REST API key and Resend API key are stored as Supabase secrets — not in environment variables exposed to the frontend.
- [ ] Email templates do not include user phone numbers or Venmo handles except where explicitly specified (N2 — claim approved email to claimer).
- [ ] The `notifications` table is only readable by the recipient user (RLS: `auth.uid() = user_id`). Insertions happen via service role (bypass RLS).

### 1.9 Error handling

- [ ] If OneSignal API returns an error (rate limit, invalid player ID, service down): the notification is logged as failed but does NOT block the email send. Both channels are independent.
- [ ] If Resend API returns an error: the notification is logged as failed. No retry in V1 (acceptable — note as a V1.5 improvement).
- [ ] If the dispatch function itself errors: the calling code (claim insert, post update, etc.) does NOT fail. Notification dispatch is fire-and-forget from the frontend's perspective.
- [ ] All Edge Functions return appropriate HTTP status codes: 200 on success, 400 on bad input, 500 on internal error. Cron jobs log errors to the Supabase Edge Function logs.

---

## Pass 2 — Notification dispatch function tests

Create `/src/__tests__/notification-dispatch.test.ts`. These tests mock the Edge Function behavior.

```
Test: "dispatch sends push when push_enabled and onesignal_player_id set"
  - User A: push_enabled = true for 'claim_submitted', onesignal_player_id = 'player_abc'
  - Call dispatch with { user_id: A, type: 'claim_submitted', data: {...} }
  - Assert: OneSignal API called with player_id = 'player_abc'
  - Assert: row inserted into notifications with channel = 'push'

Test: "dispatch sends email when email_enabled"
  - User A: email_enabled = true for 'claim_submitted'
  - Call dispatch
  - Assert: send-email called with User A's email, correct subject, correct HTML
  - Assert: row inserted into notifications with channel = 'email'

Test: "dispatch sends both push and email when both enabled"
  - User A: push_enabled = true, email_enabled = true
  - Call dispatch
  - Assert: both OneSignal and send-email called
  - Assert: two rows inserted into notifications (one push, one email)

Test: "dispatch skips push when onesignal_player_id is null"
  - User D: push_enabled = true but onesignal_player_id = null
  - Call dispatch
  - Assert: OneSignal API NOT called
  - Assert: email still sent (fallback)

Test: "dispatch skips push when push_enabled is false"
  - User D: push_enabled = false, email_enabled = true
  - Call dispatch
  - Assert: OneSignal API NOT called
  - Assert: email sent

Test: "dispatch sends nothing when both channels disabled"
  - User with push_enabled = false, email_enabled = false for this type
  - Call dispatch
  - Assert: neither OneSignal nor send-email called
  - Assert: no row inserted into notifications (or row inserted with status 'skipped')

Test: "dispatch respects per-type preferences"
  - User B: push_enabled = true for 'claim_approved', push_enabled = false for 'claim_submitted'
  - Dispatch 'claim_submitted' → assert: push NOT sent
  - Dispatch 'claim_approved' → assert: push sent

Test: "dispatch creates default preferences if none exist for this type"
  - User with no row in notification_preferences for 'game_reminder'
  - Call dispatch for 'game_reminder'
  - Assert: uses defaults (email = true, push = false) — does NOT error

Test: "dispatch handles OneSignal API failure gracefully"
  - Mock OneSignal API to return 500
  - Call dispatch
  - Assert: email still sent
  - Assert: notification logged (push failed, email succeeded)

Test: "dispatch handles Resend API failure gracefully"
  - Mock Resend to return 500
  - Call dispatch
  - Assert: push still sent
  - Assert: notification logged (push succeeded, email failed)

Test: "dispatch never sends SMS in V1"
  - Any notification type, any user preferences
  - Assert: no SMS API call ever made
  - Assert: no notification row with channel = 'sms'
```

---

## Pass 3 — Notification preferences UI tests

Create `/src/__tests__/notification-preferences.test.tsx`.

```
Test: "preferences screen lists all notification types"
  - Render the notification preferences screen
  - Assert: all 13 notification types from the matrix are listed (or the user-facing subset — some types like 48h nudge are poster-only and may not have a toggle)

Test: "each type has push and email toggles"
  - Assert: each row has two toggles — push and email
  - Assert: SMS column either not shown or shown as disabled/"Coming soon"

Test: "default state: email on, push off for all types"
  - Render preferences for a new user with no rows in notification_preferences
  - Assert: all email toggles ON
  - Assert: all push toggles OFF

Test: "toggling push on saves to notification_preferences"
  - Toggle push ON for 'claim_submitted'
  - Assert: upsert called on notification_preferences with push_enabled = true

Test: "toggling email off saves to notification_preferences"
  - Toggle email OFF for 'claim_submitted'
  - Assert: upsert called with email_enabled = false

Test: "preferences persist across page reloads"
  - Set push ON for 'claim_approved', navigate away, return
  - Assert: push toggle for 'claim_approved' is still ON

Test: "toggling shows optimistic UI"
  - Toggle push ON
  - Assert: toggle shows ON immediately (before Supabase responds)
  - Assert: reverts on error

Test: "friend new post notification defaults to off"
  - Type N13 ('friend_new_post') defaults to push = false, email = false
  - Assert: both toggles OFF for this type
  - (This is the only type that defaults to fully off per the product plan)

Test: "sms_enabled is never set to true"
  - Toggle every available control
  - Assert: no upsert call ever sets sms_enabled = true
```

---

## Pass 4 — Event-driven trigger tests

Create `/src/__tests__/notification-triggers.test.ts`. These test that the correct dispatch calls fire at the correct moments in the app lifecycle.

```
Test: "N1 — claim submitted triggers notification to poster"
  - User B claims a spot on User A's post
  - Assert: send-notification called with { user_id: A, type: 'claim_submitted', data: { claimer_name, post_id, ... } }

Test: "N2 — claim approved triggers notification to claimer"
  - User A approves User B's claim
  - Assert: send-notification called with { user_id: B, type: 'claim_approved', data: { poster_name, venmo_link, post_summary, ... } }

Test: "N3 — claim rejected triggers notification to claimer"
  - User A rejects User B's claim with reason 'wrong_skill_level'
  - Assert: send-notification called with { user_id: B, type: 'claim_rejected', data: { reason: 'wrong_skill_level', post_summary, ... } }

Test: "N3 — claim rejected without reason still triggers notification"
  - User A rejects without a reason
  - Assert: send-notification called with reason = null

Test: "N4 — claimer backs out triggers notification to poster"
  - User B unclaims (status → 'unclaimed')
  - Assert: send-notification called with { user_id: A, type: 'claimer_backed_out', data: { claimer_name, post_summary } }

Test: "N5 — cost changed triggers notification to all active claimers"
  - Post has 2 claimers: User B (pending), User C (approved)
  - Poster reduces cost from $40 to $25
  - Assert: send-notification called twice — once for User B, once for User C
  - Assert: data includes old_cost, new_cost, and back_out option

Test: "N5 — cost changed does NOT notify rejected or unclaimed claimers"
  - Post has 1 rejected claim (User D) and 1 pending claim (User B)
  - Poster reduces cost
  - Assert: send-notification called only for User B, NOT User D

Test: "N7 — claimer cancels pending claim triggers notification to poster"
  - User B cancels their pending claim
  - Assert: send-notification called with { user_id: A, type: 'claimer_cancelled' }
  - (N7 is distinct from N4 — N4 is backing out of an approved claim, N7 is cancelling a pending one. If the implementation treats them as the same type, verify the dispatch still fires correctly in both cases.)

Test: "N8 — price drop triggers notification to prior viewers"
  - Users C and D have viewed the post (rows in post_views)
  - Poster reduces cost
  - Assert: send-notification called for User C and User D with type 'price_drop'
  - Assert: channel is push only per the matrix

Test: "N8 — price drop does NOT notify the poster themselves"
  - Poster viewed their own post (has a post_views row)
  - Assert: poster NOT included in price drop notification recipients

Test: "N9 — spot reopened triggers notification to notify_me watchers"
  - User C has a notify_me entry for a full post
  - A claim is unclaimed, reopening a spot
  - Assert: send-notification called for User C with type 'spot_reopened'

Test: "N9 — spot reopened via rejection also triggers notify_me"
  - Poster rejects a claim
  - Assert: notify_me watchers notified

Test: "N13 — friend posts new sub need triggers notification to followers"
  - User A creates a new sub_need post
  - User C follows User A
  - Assert: send-notification called for User C with type 'friend_new_post'
  - Assert: this notification defaults to push only and off by default — only fires if User C has explicitly opted in

Test: "notification dispatch failure does not block the triggering action"
  - Mock send-notification to throw an error
  - User B claims a spot
  - Assert: claim still inserted successfully
  - Assert: no error toast related to notifications shown to User B
```

---

## Pass 5 — Scheduled cron job tests

These tests validate the Edge Functions invoked by pg_cron. Test by calling each Edge Function directly via curl (or via Supabase client with service role key). Do NOT rely on waiting for cron schedules.

Create `/src/__tests__/cron-jobs.test.ts` for the query logic, and use curl commands for integration testing.

### 5.1 12h nudge — `nudge-unresponded-claims`

```
Test: "finds claims pending > 12 hours"
  - Claim C1 is pending, created 13 hours ago
  - Call the Edge Function
  - Assert: notification sent to both poster (User A) and claimer (User B) simultaneously
  - Assert: type = '12h_nudge'

Test: "does not nudge claims pending < 12 hours"
  - Create a claim pending for only 2 hours
  - Call the Edge Function
  - Assert: no notification sent for this claim

Test: "does not nudge approved claims"
  - Claim has status = 'approved' (even if created > 12h ago)
  - Assert: no nudge sent

Test: "does not nudge rejected or unclaimed claims"
  - Assert: only 'pending' status claims are eligible

Test: "deduplication — nudge sent only once per claim"
  - Call the Edge Function twice
  - Assert: notification sent on first call
  - Assert: notification NOT sent on second call (deduplicated via notifications table check)

Test: "does not nudge claims on expired posts"
  - Post has status = 'expired' with a pending claim
  - Assert: no nudge sent

Curl integration test:
  curl -X POST https://[project].supabase.co/functions/v1/nudge-unresponded-claims \
    -H "Authorization: Bearer [service_role_key]" \
    -H "Content-Type: application/json"
  Assert: 200 response. Check notifications table for new rows.
```

### 5.2 48h unfilled nudge — `48h-unfilled-nudge`

```
Test: "finds active sub_need posts unfilled for 48h with game coming"
  - Post P3: created 49 hours ago, game in 2 days, no claims
  - Call the Edge Function
  - Assert: notification sent to poster (User A)
  - Assert: type = '48h_unfilled'
  - Assert: body includes discount suggestion

Test: "does not nudge posts with approved claims filling all spots"
  - Post has spots_total = 1 and 1 approved claim
  - Assert: no nudge sent

Test: "does nudge posts with some spots still open"
  - Post has spots_total = 3, 1 approved claim (2 spots open)
  - Assert: nudge sent

Test: "deduplication — sent only once per post"
  - Call Edge Function twice for the same post
  - Assert: notification sent only on first call

Test: "does not nudge regular_game posts"
  - Assert: only post_type = 'sub_need' is eligible

Test: "does not nudge posts already expired"
  - Post has status = 'expired'
  - Assert: no nudge

Curl integration test:
  curl -X POST https://[project].supabase.co/functions/v1/48h-unfilled-nudge \
    -H "Authorization: Bearer [service_role_key]"
  Assert: 200 response. Check notifications table.
```

### 5.3 Game reminder — `game-reminders`

```
Test: "sends reminder day before game to poster and approved claimers"
  - Post P5: game date = tomorrow, 1 approved claim by User B
  - Call the Edge Function
  - Assert: notification sent to User A (poster) and User B (approved claimer)
  - Assert: type = 'game_reminder'
  - Assert: channel = push only

Test: "does not send reminder to pending claimers"
  - Post has a pending claim only
  - Assert: poster notified, pending claimer NOT notified

Test: "does not send reminder for games > 1 day away"
  - Post with game date 3 days from now
  - Assert: no reminder

Test: "does not send reminder for games today (already past day-before)"
  - Post with game date today
  - Assert: no reminder (the day-before window has passed)

Test: "deduplication — sent only once per post per recipient"
  - Call Edge Function twice
  - Assert: reminder sent only on first call

Curl integration test:
  curl -X POST https://[project].supabase.co/functions/v1/game-reminders \
    -H "Authorization: Bearer [service_role_key]"
  Assert: 200 response. Check notifications table.
```

### 5.4 Friend expiry alert — `friend-expiry-alerts`

```
Test: "sends alert for unfilled friend posts within 4 hours of game"
  - Post P2: game in 5 hours (within 4h window on next hourly run), status = active, no approved claims filling all spots
  - User C follows User A (poster)
  - Call the Edge Function
  - Assert: notification sent to User C
  - Assert: type = 'friend_expiry'
  - Assert: body matches spec: "[User A name]'s spot at [Location] is still open — game starts in 4 hours."

Test: "does not alert for posts where all spots are approved"
  - Post has spots_total = 1, 1 approved claim
  - Assert: no alert

Test: "does alert for posts with some spots still open"
  - Post has spots_total = 2, 1 approved claim (1 spot open)
  - Assert: alert sent to followers

Test: "does alert for posts with pending-only claims (not approved)"
  - Post has 1 pending claim, 0 approved — spot is not confirmed
  - Assert: alert sent (pending is not filled)

Test: "does not alert for posts > 4 hours from game"
  - Post with game in 8 hours
  - Assert: no alert

Test: "does not alert for expired posts"
  - Post with status = 'expired'
  - Assert: no alert

Test: "deduplication — once per post per follower"
  - Call the Edge Function twice for the same post
  - Assert: User C notified only on first call
  - Assert: second call checks notifications table and skips

Test: "alerts all followers, not just one"
  - User C and User D both follow User A
  - Assert: both receive the alert

Test: "does not alert the poster themselves"
  - User A follows themselves (edge case)
  - Assert: User A NOT notified by the friend expiry alert for their own post

Curl integration test:
  curl -X POST https://[project].supabase.co/functions/v1/friend-expiry-alerts \
    -H "Authorization: Bearer [service_role_key]"
  Assert: 200 response. Check notifications table for friend_expiry rows.
```

### 5.5 Auto-expire cron jobs

These are direct SQL cron jobs (not Edge Functions), but verify they work:

```
Test: "auto-expire sub_need posts after game date/time passes"
  - Create a post with game_date = yesterday, status = 'active'
  - Run: UPDATE public.posts SET status = 'expired' WHERE status = 'active' AND post_type = 'sub_need' AND (game_date + game_time) < now()
  - Assert: post status = 'expired'

Test: "auto-expire does not affect active posts with future game dates"
  - Post with game_date = tomorrow
  - Assert: status still 'active' after cron run

Test: "auto-expire regular_game posts after 30 days"
  - Create a regular_game post with expires_at = yesterday
  - Run: UPDATE public.posts SET status = 'expired' WHERE status = 'active' AND post_type = 'regular_game' AND expires_at < now()
  - Assert: post status = 'expired'

Test: "auto-expire does not affect regular_game posts within 30 days"
  - Post with expires_at = 15 days from now
  - Assert: status still 'active'
```

---

## Pass 6 — Push permission prompt tests

Create `/src/__tests__/push-permission.test.tsx`.

```
Test: "push prompt shown after user creates first post"
  - User creates their first sub_need post (post count goes from 0 to 1)
  - Assert: inline push permission prompt appears
  - Assert: prompt text is contextual (e.g., "Enable push notifications to know when someone claims your spot")

Test: "push prompt shown after user views a post without claiming"
  - User views a post detail page, does not claim
  - Assert: inline push prompt appears
  - Assert: prompt text: "Get notified when prices drop or new spots open at your skill level."

Test: "push prompt not shown if user already has onesignal_player_id"
  - User has already opted into push
  - Assert: prompt never shown

Test: "push prompt dismissable"
  - Dismiss the prompt
  - Assert: prompt disappears
  - Assert: prompt does not reappear on next post creation or view

Test: "dismissal persists across sessions"
  - Dismiss prompt, reload the app
  - Assert: prompt does not reappear

Test: "accepting push prompt stores onesignal_player_id"
  - Mock OneSignal permission flow to return a player ID
  - Accept the prompt
  - Assert: user's Supabase row updated with onesignal_player_id

Test: "push prompt does not appear on first page load"
  - New user signs in for the first time, lands on feed
  - Assert: no push permission prompt (no browser permission dialog)
```

---

## Pass 7 — Run tests and fix

1. Run all tests: `npx vitest run`
2. Fix code (not tests) for any failures.
3. After all tests pass, run `npm run build` to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time.

---

## Pass 8 — Manual verification checklist

### Notification preferences UI:

- [ ] Navigate to Settings > Notification Preferences.
- [ ] All notification types listed with push and email toggles.
- [ ] Email defaults to ON, push defaults to OFF for all types.
- [ ] Friend new post defaults to OFF for both.
- [ ] SMS column disabled or hidden with "Coming soon" label.
- [ ] Toggle push ON for a type → verify row upserted in notification_preferences (check Supabase dashboard).
- [ ] Toggle email OFF for a type → verify row updated.
- [ ] Preferences persist after leaving and returning to Settings.

### Push permission prompt:

- [ ] Create first post → push permission prompt appears inline (not a browser dialog).
- [ ] Dismiss the prompt → does not reappear.
- [ ] Accept the prompt → browser push permission dialog fires. On accept, `onesignal_player_id` stored in Supabase.

### Real notification delivery — event-driven:

For each test, verify delivery in both OneSignal dashboard (push) and Resend dashboard (email). Sign in as each user in separate browser tabs.

- [ ] **N1:** User B claims User A's post → User A receives push + email. Email subject references the post.
- [ ] **N2:** User A approves → User B receives push + email. Email includes Venmo link and post summary.
- [ ] **N3:** User A rejects (with reason) → User B receives push + email with reason.
- [ ] **N4:** User B backs out of approved claim → User A receives push + email.
- [ ] **N5:** User A reduces cost → User B (pending claimer) receives push + email with old/new cost.
- [ ] **N7:** User B cancels pending claim → User A receives push + email.
- [ ] **N9:** After a claim is unclaimed/rejected, notify_me watchers receive notification.

### Real notification delivery — preferences respected:

- [ ] Disable push for 'claim_submitted' for User A. User B claims → User A receives email only, no push.
- [ ] Disable email for 'claim_approved' for User B. User A approves → User B receives push only, no email.
- [ ] Disable both channels for a type → no notification received.

### Real notification delivery — cron jobs:

Test each by invoking the Edge Function directly via curl:

- [ ] **N6 (12h nudge):** Post P4 has a 13h-old pending claim. Invoke `nudge-unresponded-claims`. Both User A and User B receive push + email simultaneously. Run again — no duplicate.
- [ ] **N10 (48h unfilled):** Post P3 is 49h old with no claims. Invoke `48h-unfilled-nudge`. User A receives push with discount suggestion. Run again — no duplicate.
- [ ] **N11 (game reminder):** Post P5 has game tomorrow with approved claim. Invoke `game-reminders`. User A and User B receive push. Run again — no duplicate.
- [ ] **N12 (friend expiry):** Post P2 has game in 5h, no approved claims. Invoke `friend-expiry-alerts`. User C (follower) receives push + email with alert copy matching spec. Run again — no duplicate. User A (poster) does NOT receive their own friend expiry alert.

### Email quality:

- [ ] Open one notification email on a mobile device (or Gmail mobile view).
- [ ] Email is readable: single-column, no horizontal scroll, text legible.
- [ ] CTA button in email links to the correct screen (post detail or My Activity).
- [ ] Unsubscribe/preferences link in email footer works (links to Settings > Notification Preferences).

### Mobile UX:

- [ ] Notification preferences screen renders correctly on 390px viewport.
- [ ] All toggles are tappable (44px minimum touch target).
- [ ] Push permission prompt renders inline (not blocking content), dismissable.
- [ ] No horizontal scroll on any Phase 7 screen.

---

## Summary of deliverables

After completing all eight passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files in `/src/__tests__/`:
   - `notification-dispatch.test.ts`
   - `notification-preferences.test.tsx`
   - `notification-triggers.test.ts`
   - `cron-jobs.test.ts`
   - `push-permission.test.tsx`
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. All cron jobs verified via direct curl invocation with deduplication confirmed.
6. Real push and email delivery verified for at least N1, N2, N3, N6, N12.
7. Manual verification checklist completed with all items checked.

If OneSignal or Resend sandbox has delivery limitations that prevent full end-to-end testing, note the limitation and verify as far as the sandbox allows. Confirm the dispatch function logs correctly to the `notifications` table regardless of external delivery success.
