# CourtPlay — Phase 5 Eval: Deep Links & Sharing

## How to use this eval

Run this prompt in Claude Code after Phase 5 is complete. It validates the deep link post detail page, the share flow, the sign-up redirect chain, and Open Graph meta tags. Phase 5 is the first feature that serves unauthenticated users — making security boundaries and graceful degradation especially important.

The eval has five passes:

1. **Code quality audit** — Review all Phase 5 code for correctness, security, and best practices.
2. **Post detail page tests** — Authenticated, unauthenticated, expired, and deleted states.
3. **Share functionality tests** — Web Share API, fallback modal, share text formatting, URI schemes.
4. **Redirect chain tests** — Sign-up redirect preservation through onboarding back to the post.
5. **Manual verification** — Visual/UX checklist in a 390px mobile viewport.

Work through each pass sequentially. Fix issues before proceeding.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phases 3 and 4 evals pass completely — the feed, SubCard, GroupCard, claim flow, and spot counter are all working.
4. Supabase database has the full schema applied with all RLS policies.
5. Test data exists:
   - **Post A** — active `sub_need` post with a future game date, spots available, created by User A. Note the post ID.
   - **Post B** — active `regular_game` post, created by User A. Note the post ID.
   - **Post C** — expired post (`status = 'expired'`). Note the post ID.
   - **Post D** — deleted post (`status = 'deleted'`, `deleted_at` set). Note the post ID.
   - **Post E** — active `sub_need` post with all spots filled (spots_available = 0). Note the post ID.
   - **User A** — authenticated test user (the poster).
   - **User B** — authenticated test user (potential claimer).
6. You have a way to test in a logged-out state (incognito window or signed-out browser).

---

## Critical architecture issue: RLS and unauthenticated access

Before running any tests, address this:

The current RLS policy on `posts` requires `auth.role() = 'authenticated'`:
```sql
create policy "Signed-in users read posts" on public.posts
  for select using (auth.role() = 'authenticated' and status = 'active');
```

Phase 5 requires unauthenticated users to view post previews at `/post/:id`. There are two valid approaches — pick one and implement it:

**Option A — Public RLS policy for single-post reads:**
Add a second RLS policy that allows unauthenticated reads of individual active posts:
```sql
create policy "Public read single active post" on public.posts
  for select using (status = 'active');
```
This is simpler but exposes the posts table to unauthenticated `select` queries broadly. Acceptable for V1 since all posts are public anyway.

**Option B — Supabase Edge Function for public post preview:**
Create an Edge Function (`get-public-post`) that uses the service role to fetch a single post by ID and returns only the preview-safe fields (format, date, time, skill level, location, cost, spots available, poster first name). The frontend calls this function for unauthenticated users instead of querying Supabase directly.

Document which approach was chosen and verify it works before proceeding with the eval.

---

## Pass 1 — Code quality audit

Review every file created or modified in Phase 5. Log violations as a numbered list.

### 1.1 File structure compliance

Verify the following files exist in the correct locations:

```
/src/pages/PostDetail.tsx          (or /src/pages/Post/Detail.tsx)
/src/components/app/ShareButton.tsx (or ShareSheet.tsx)
/src/components/app/PostPreview.tsx (unauthenticated preview variant)
```

Confirm no Phase 5 code was placed in `/src/components/ui/`.

### 1.2 TypeScript quality

For every `.ts` and `.tsx` file in Phase 5:

- [ ] No `any` types.
- [ ] Post detail page correctly types the route parameter (`:id`) — using `useParams<{ id: string }>()` or equivalent with a type guard that validates the ID format before querying.
- [ ] The `navigator.share` API call is correctly typed — `navigator.share` may not exist on all browsers. Verify the code checks `typeof navigator.share === 'function'` or `navigator.share !== undefined` before calling it.
- [ ] Share text template is typed, not assembled with string concatenation of unvalidated fields. Null fields (e.g., missing `cost` on a regular_game post) must not produce `undefined` or `null` in the share text.
- [ ] Open Graph meta tag values are properly sanitized — no raw HTML or unescaped special characters in `og:description`.

### 1.3 Authenticated vs. unauthenticated rendering

The post detail page must render two distinct views based on auth state. Verify:

- [ ] The page checks auth state on mount (via `useAuth` hook or equivalent).
- [ ] **Authenticated view:** Full post card (SubCard or GroupCard) with Claim button, share button, report menu — identical to the feed card but on its own page.
- [ ] **Unauthenticated view:** Limited preview showing ONLY: format, date, time, skill level, location, cost, spots available. Does NOT show: poster name, avatar, view count, friend badge, claim button, report menu.
- [ ] The unauthenticated view includes a prominent CTA: "Sign in to claim this spot" linking to `/signup?redirect=/post/[id]`.
- [ ] The CTA button uses `--color-primary` and is visually prominent — not a text link buried in the page.
- [ ] No sensitive data leaks in the unauthenticated view: no poster phone, no Venmo handle, no claim details, no follower data.

### 1.4 Expired and deleted post handling

- [ ] If the post has `status = 'expired'` or `status = 'deleted'` or `deleted_at is not null`:
  - Show message: "This spot is no longer available."
  - Show CTA: "Browse open spots →"
  - CTA links to `/feed` if user is authenticated, `/signup` if not.
- [ ] The page does NOT show any post details for expired/deleted posts — no format, date, skill level, etc.
- [ ] If the post ID does not exist in the database (invalid UUID or no matching row), show a 404-style message: "Post not found" or equivalent. Do not show a blank page or crash.
- [ ] If the post ID is not a valid UUID format, handle gracefully — do not pass a malformed string to Supabase.

### 1.5 Open Graph meta tags

- [ ] The page sets the following `<meta>` tags dynamically based on post data:
  - `og:title` — e.g., "Tennis sub needed — 3.5 level at Longshore Club"
  - `og:description` — e.g., "Point play on Thu, Apr 10 at 9:00 AM. $25. 1 spot available. Claim it on CourtPlay."
  - `og:url` — `https://courtplay.com/post/[id]`
  - `og:type` — `website`
- [ ] Meta tags are set using `react-helmet`, `react-helmet-async`, or direct `document.head` manipulation — verify the approach works for link previews. **Important:** Client-side rendered meta tags may NOT be picked up by iMessage, WhatsApp, or social platform crawlers, which typically do not execute JavaScript. If using client-side rendering only, note this as a known limitation and recommend server-side rendering or a Supabase Edge Function that returns an HTML page with pre-rendered OG tags for crawler user agents.
- [ ] Meta tags handle missing fields gracefully — if a field is null, the tag should still produce a readable description, not "null" or "undefined".
- [ ] For expired/deleted posts, OG tags should show a generic message: "This spot is no longer available on CourtPlay" — not the original post details.

### 1.6 Share text formatting

Verify the share text template matches the spec exactly:

```
[Name] needs a [skill level] tennis sub at [Location] on [Date] at [Time]. $[Cost]. Claim it on CourtPlay: [URL]
```

- [ ] `[Name]` is the poster's first name only (not full name, not email).
- [ ] `[skill level]` is the NTRP level (e.g., "3.5").
- [ ] `[Location]` is the court name (from courts table or custom_court). Not null, not "undefined".
- [ ] `[Date]` is formatted as a human-readable date (e.g., "Thu, Apr 10") — not an ISO string, not a raw `Date` object.
- [ ] `[Time]` is formatted in 12-hour format (e.g., "9:00 AM") — not 24-hour, not a raw `Time` object.
- [ ] `[Cost]` includes the dollar sign and is the current cost (discounted if applicable), not `original_cost`.
- [ ] `[URL]` is `https://courtplay.com/post/[id]` — not `localhost`, not a relative path.
- [ ] For `regular_game` posts (no date/time/cost), the share text adapts gracefully. Suggested format: "[Name] is looking for a regular [skill level] tennis game in Westport. See details on CourtPlay: [URL]"

### 1.7 Web Share API and fallback

- [ ] The share button checks for Web Share API support before calling it.
- [ ] On browsers that support it (iOS Safari): `navigator.share({ title, text, url })` is called.
- [ ] On browsers that do NOT support it: a fallback share sheet modal opens with three options:
  1. **Copy link** — copies `https://courtplay.com/post/[id]` to clipboard. Shows confirmation toast: "Link copied."
  2. **Share to iMessage** — opens `sms:&body=[encoded share text]` URI.
  3. **Share to WhatsApp** — opens `https://wa.me/?text=[encoded share text]` in a new tab/window.
- [ ] The fallback modal uses an Untitled UI Modal/Dialog component — not a browser `alert` or `prompt`.
- [ ] The modal is dismissable by tapping outside or a close button.
- [ ] Share text in iMessage and WhatsApp URIs is URL-encoded.

### 1.8 Security

- [ ] The unauthenticated post preview does not call any Supabase queries that require authentication (or uses the appropriate public access method per the architecture decision above).
- [ ] The `redirect` query parameter (`/signup?redirect=/post/[id]`) is validated before use — it must start with `/post/` and contain a valid UUID. An attacker should not be able to set `redirect=https://evil.com` and have the app redirect there after sign-up.
- [ ] No user PII is included in Open Graph tags or share text beyond the poster's first name.
- [ ] View count is NOT incremented for unauthenticated viewers — only authenticated users trigger the `increment_view_count` RPC and `post_views` upsert.

### 1.9 React best practices

- [ ] The post detail page shows a loading state (spinner/skeleton) while the post is being fetched.
- [ ] The page handles the Supabase query error state — shows an error message with retry, not a blank screen.
- [ ] The share button click handler does not cause a re-render of the entire post card.
- [ ] `useEffect` for fetching the post has the correct dependency array (only `id` from route params).
- [ ] The page does not fetch the post again on every render — uses the fetched data from state.
- [ ] Copy-to-clipboard uses the modern `navigator.clipboard.writeText()` API with a fallback for older browsers (e.g., `document.execCommand('copy')`).

### 1.10 Design token compliance

- [ ] No hardcoded hex colors in any Phase 5 component.
- [ ] "Sign in to claim this spot" CTA uses `--color-primary` background, `--color-background` text.
- [ ] Share sheet modal uses the token palette.
- [ ] "This spot is no longer available" message uses `--color-text-secondary`.
- [ ] Share button icon uses `--color-text-secondary` at rest, `--color-text-primary` on hover/tap.

---

## Pass 2 — Post detail page tests

Create `/src/__tests__/post-detail.test.tsx`.

```
Test: "renders full post card for authenticated user viewing active sub_need"
  - Mock auth state as authenticated (User B)
  - Mock Supabase query returning Post A (active sub_need)
  - Render PostDetail with route param id = Post A's ID
  - Assert visible: format badge, date, time, skill level, total players, location, poster name, spots indicator, cost, view count, Claim button, share button

Test: "renders full GroupCard for authenticated user viewing active regular_game"
  - Mock auth state as authenticated
  - Mock Supabase query returning Post B (active regular_game)
  - Render PostDetail with route param id = Post B's ID
  - Assert visible: format interests, skill level, preferred days/times, courts, poster name, share button
  - Assert: no Claim button (regular_game posts have no claim flow)

Test: "renders preview for unauthenticated user viewing active sub_need"
  - Mock auth state as unauthenticated
  - Mock query returning Post A
  - Render PostDetail
  - Assert visible: format, date, time, skill level, location, cost, spots available
  - Assert visible: "Sign in to claim this spot" CTA button
  - Assert NOT visible: poster name, avatar, view count, Claim button, report menu

Test: "unauthenticated CTA links to signup with redirect"
  - Mock auth state as unauthenticated
  - Render PostDetail for Post A
  - Assert: CTA link href = "/signup?redirect=/post/[Post A ID]"

Test: "renders expired state for expired post — authenticated user"
  - Mock auth state as authenticated
  - Mock query returning Post C (status = 'expired')
  - Render PostDetail
  - Assert visible: "This spot is no longer available."
  - Assert visible: "Browse open spots →" linking to /feed
  - Assert NOT visible: any post details (format, date, cost, etc.)

Test: "renders expired state for expired post — unauthenticated user"
  - Mock auth state as unauthenticated
  - Mock query returning Post C
  - Render PostDetail
  - Assert visible: "This spot is no longer available."
  - Assert visible: "Browse open spots →" linking to /signup
  - Assert NOT visible: any post details

Test: "renders expired state for deleted post"
  - Mock query returning Post D (status = 'deleted', deleted_at set)
  - Render PostDetail
  - Assert visible: "This spot is no longer available."
  - Assert NOT visible: any post details

Test: "renders 404 for non-existent post ID"
  - Mock Supabase query returning null/empty for a valid UUID that doesn't match any post
  - Render PostDetail
  - Assert visible: "Post not found" or equivalent message
  - Assert: no crash, no blank screen

Test: "handles invalid UUID in route param"
  - Render PostDetail with route param id = "not-a-uuid"
  - Assert: does NOT call Supabase with malformed ID
  - Assert visible: "Post not found" or equivalent

Test: "shows loading state while fetching"
  - Mock Supabase query with a delayed response
  - Render PostDetail
  - Assert: loading spinner/skeleton visible before data arrives
  - Assert: post content visible after data arrives

Test: "shows error state on fetch failure"
  - Mock Supabase query to reject with an error
  - Render PostDetail
  - Assert visible: error message with retry option
  - Assert: no blank screen, no unhandled promise rejection

Test: "view count incremented for authenticated user only"
  - Mock auth as authenticated, render PostDetail for Post A
  - Assert: increment_view_count RPC called
  - Assert: post_views upsert called
  - Mock auth as unauthenticated, render PostDetail for Post A
  - Assert: increment_view_count RPC NOT called
  - Assert: post_views upsert NOT called

Test: "post detail page shows Claim button for authenticated user on post with spots"
  - Render PostDetail as authenticated user for Post A (spots available)
  - Assert: Claim button visible and enabled

Test: "post detail page shows Notify Me for authenticated user on full post"
  - Render PostDetail as authenticated user for Post E (spots_available = 0)
  - Assert: "Notify me if this opens up" link visible
  - Assert: Claim button NOT visible
```

---

## Pass 3 — Share functionality tests

Create `/src/__tests__/share-functionality.test.tsx`.

### 3.1 Share text formatting

```
Test: "share text formatted correctly for sub_need post"
  - Input: Post A — poster "Jane", skill_level "3.5", location "Longshore Club", game_date April 10, game_time 9:00 AM, cost $25, id "abc-123"
  - Call the share text generator function
  - Assert output: "Jane needs a 3.5 tennis sub at Longshore Club on Thu, Apr 10 at 9:00 AM. $25. Claim it on CourtPlay: https://courtplay.com/post/abc-123"

Test: "share text uses discounted cost when original_cost exists"
  - Post has cost = 15, original_cost = 25
  - Assert share text includes "$15" not "$25"

Test: "share text handles regular_game post without date/time/cost"
  - Input: Post B — poster "Jane", skill_level "4.0", post_type "regular_game"
  - Assert output does NOT contain "undefined", "null", "NaN", or "$null"
  - Assert output is a coherent sentence (e.g., "Jane is looking for a regular 4.0 tennis game in Westport. See details on CourtPlay: [URL]")

Test: "share text handles custom court name"
  - Post has court_id = null, custom_court = "My backyard court"
  - Assert share text uses "My backyard court" as the location

Test: "share text uses courtplay.com domain, not localhost"
  - Assert share URL starts with "https://courtplay.com/post/"
  - Assert share URL does NOT contain "localhost" or "127.0.0.1"

Test: "share text date is human-readable"
  - game_date = "2026-04-10" (ISO string from database)
  - Assert formatted as "Thu, Apr 10" or similar — NOT "2026-04-10"

Test: "share text time is 12-hour format"
  - game_time = "09:00:00" (time string from database)
  - Assert formatted as "9:00 AM" — NOT "09:00:00" or "9:00"

Test: "share text special characters do not break formatting"
  - location = "Town Hall & Courts"
  - Assert share text renders correctly with the ampersand
```

### 3.2 Web Share API

```
Test: "uses navigator.share when available"
  - Mock navigator.share as a function
  - Click share button
  - Assert: navigator.share called with { title, text, url }
  - Assert: fallback modal NOT opened

Test: "opens fallback modal when navigator.share is unavailable"
  - Mock navigator.share as undefined
  - Click share button
  - Assert: fallback share sheet modal opens
  - Assert: modal contains "Copy link", iMessage, and WhatsApp options

Test: "handles navigator.share rejection gracefully"
  - Mock navigator.share to reject (user cancelled the system share sheet)
  - Click share button
  - Assert: no error toast, no crash — share simply cancelled

Test: "handles navigator.share AbortError specifically"
  - Mock navigator.share to reject with DOMException name = "AbortError"
  - Assert: treated as user cancellation — no error shown
```

### 3.3 Fallback share options

```
Test: "Copy link copies correct URL to clipboard"
  - Mock navigator.clipboard.writeText
  - Open fallback modal, tap "Copy link"
  - Assert: navigator.clipboard.writeText called with "https://courtplay.com/post/[id]"
  - Assert: confirmation toast shown — "Link copied" or similar

Test: "Copy link fallback works when clipboard API unavailable"
  - Mock navigator.clipboard as undefined
  - Open fallback modal, tap "Copy link"
  - Assert: fallback mechanism used (e.g., document.execCommand('copy') via a temporary textarea)
  - Assert: confirmation toast still shown

Test: "iMessage share opens sms URI with encoded share text"
  - Open fallback modal, tap iMessage option
  - Assert: opens URI matching pattern sms:&body=[URL-encoded share text]
  - Assert: share text is properly URL-encoded (spaces as %20 or +, special chars encoded)

Test: "WhatsApp share opens wa.me with encoded share text"
  - Open fallback modal, tap WhatsApp option
  - Assert: opens URL matching pattern https://wa.me/?text=[URL-encoded share text]
  - Assert: URL opens in new tab/window (target="_blank" or window.open)

Test: "fallback modal is dismissable"
  - Open fallback modal
  - Tap outside the modal (or tap close button)
  - Assert: modal closes
  - Assert: no side effects (no clipboard copy, no URI opened)
```

### 3.4 Share button on cards

```
Test: "share button renders on SubCard"
  - Render SubCard component
  - Assert: share button (⬆ icon or equivalent) is visible

Test: "share button renders on GroupCard"
  - Render GroupCard component
  - Assert: share button is visible

Test: "share button on post detail page works same as feed card"
  - Render PostDetail for Post A as authenticated user
  - Assert: share button present and functional
```

---

## Pass 4 — Redirect chain tests

Create `/src/__tests__/signup-redirect.test.ts`.

```
Test: "redirect param preserved in signup URL"
  - Unauthenticated user on /post/abc-123 taps "Sign in to claim this spot"
  - Assert: navigation to /signup?redirect=/post/abc-123

Test: "redirect param preserved through signup form submission"
  - Simulate signup flow starting from /signup?redirect=/post/abc-123
  - After auth completes, assert: redirect target is /post/abc-123
  - (If onboarding is required for new users, redirect should happen AFTER onboarding, not before)

Test: "redirect works after onboarding completion for new users"
  - New user signs up from /signup?redirect=/post/abc-123
  - User completes onboarding flow (Phase 1b)
  - After onboarding, assert: user lands on /post/abc-123, not /feed

Test: "redirect works for existing users signing in"
  - Existing user (already onboarded) visits /post/abc-123 while logged out
  - Taps "Sign in to claim this spot" → /signup?redirect=/post/abc-123
  - Signs in with existing account
  - Assert: lands on /post/abc-123, not /feed

Test: "redirect defaults to /feed when no redirect param"
  - User signs up at /signup (no redirect param)
  - After onboarding, assert: lands on /feed

Test: "redirect param validated — rejects external URLs"
  - Navigate to /signup?redirect=https://evil.com
  - After auth, assert: does NOT redirect to https://evil.com
  - Assert: redirects to /feed instead (safe default)

Test: "redirect param validated — rejects non-post paths"
  - Navigate to /signup?redirect=/admin
  - After auth, assert: redirects to /feed, not /admin
  - (redirect should only honor /post/ paths for deep link flow; all other paths go to /feed)

Test: "redirect param validated — rejects javascript: URI"
  - Navigate to /signup?redirect=javascript:alert(1)
  - After auth, assert: redirects to /feed, no script execution

Test: "redirect to expired post shows expired state"
  - User signs up from /signup?redirect=/post/[Post C ID] (expired post)
  - After auth/onboarding, lands on /post/[Post C ID]
  - Assert: "This spot is no longer available" message shown
  - Assert: "Browse open spots →" links to /feed
```

---

## Pass 5 — Open Graph meta tag tests

Create `/src/__tests__/og-meta-tags.test.tsx`.

```
Test: "OG tags set for active sub_need post"
  - Render PostDetail for Post A
  - Assert: document has meta tag og:title containing format and skill level
  - Assert: document has meta tag og:description containing date, time, cost, location
  - Assert: document has meta tag og:url = "https://courtplay.com/post/[Post A ID]"
  - Assert: document has meta tag og:type = "website"

Test: "OG tags set for active regular_game post"
  - Render PostDetail for Post B
  - Assert: og:title contains skill level and "regular game" or equivalent
  - Assert: og:description does NOT contain "null" or "undefined"

Test: "OG tags for expired/deleted post show generic message"
  - Render PostDetail for Post C (expired)
  - Assert: og:title = "CourtPlay" or generic equivalent
  - Assert: og:description contains "no longer available" — NOT original post details

Test: "OG tags for non-existent post show generic message"
  - Render PostDetail for a non-existent ID
  - Assert: og:title = "CourtPlay" or generic equivalent

Test: "OG tags do not contain unescaped HTML"
  - Post has notes field containing <script>alert('xss')</script>
  - Assert: og:description does NOT contain raw HTML tags — content is escaped

Test: "OG description does not contain PII beyond poster first name"
  - Render PostDetail for Post A
  - Assert: og:description does NOT contain: phone number, email, Venmo handle, last name
```

**Known limitation to document:** If the app is a client-side rendered SPA (React + Vite, no SSR), Open Graph tags set via JavaScript will NOT be picked up by iMessage, WhatsApp, Facebook, or Twitter link previews. These crawlers do not execute JavaScript. Options to address this in V1.5+:

- Add a Supabase Edge Function or Vercel serverless function that returns pre-rendered HTML with OG tags for `/post/:id` routes when the `User-Agent` is a known crawler.
- Use Vercel's `@vercel/og` or a similar meta tag injection approach at the edge.

For V1, note this limitation in the eval results but do not block on it. The share text in iMessage/WhatsApp is the primary sharing mechanism; OG tags are a progressive enhancement.

---

## Pass 6 — Run tests and fix

1. Run all tests: `npx vitest run`
2. Fix code (not tests) for any failures, unless the test itself contains a bug.
3. After all tests pass, run `npm run build` to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time.

---

## Pass 7 — Manual verification checklist

Run the app locally (`npm run dev`) in Chrome DevTools at 390px viewport width.

### Post detail page — authenticated:

- [ ] Navigate to `/post/[Post A ID]` while signed in.
- [ ] Full SubCard renders with all fields: format, date, time, skill level, players, location, poster name, spots, cost, view count.
- [ ] Claim button is visible and functional (tapping it triggers Phase 4 claim flow).
- [ ] Share button is visible.
- [ ] Navigate to `/post/[Post B ID]` — GroupCard renders correctly.

### Post detail page — unauthenticated:

- [ ] Open an incognito window. Navigate to `/post/[Post A ID]`.
- [ ] Post preview renders: format, date, time, skill level, location, cost, spots available.
- [ ] Poster name, avatar, view count, Claim button, and report menu are NOT visible.
- [ ] "Sign in to claim this spot" CTA is prominently visible with green background.
- [ ] CTA links to `/signup?redirect=/post/[Post A ID]`.

### Expired / deleted / invalid posts:

- [ ] Navigate to `/post/[Post C ID]` (expired) — shows "This spot is no longer available." with correct CTA.
- [ ] Navigate to `/post/[Post D ID]` (deleted) — same expired state.
- [ ] Navigate to `/post/nonexistent-uuid-here` — shows "Post not found" or equivalent.
- [ ] Navigate to `/post/not-a-uuid` — handles gracefully, no crash.

### Redirect chain:

- [ ] In incognito, visit `/post/[Post A ID]`. Tap "Sign in to claim this spot."
- [ ] Sign up with a new account. Complete onboarding.
- [ ] After onboarding, verify you land on `/post/[Post A ID]`, not `/feed`.
- [ ] In incognito, visit `/post/[Post A ID]`. Sign in with an existing account (skip onboarding).
- [ ] Verify you land on `/post/[Post A ID]`.

### Share — iOS Safari (or Chrome for testing):

- [ ] On a SubCard in the feed, tap the share button.
- [ ] If Web Share API supported: system share sheet opens with correct title and text.
- [ ] If Web Share API not supported: fallback modal opens with Copy link, iMessage, WhatsApp.
- [ ] Tap "Copy link" — toast confirms "Link copied." Paste confirms correct URL.
- [ ] Tap iMessage option — Messages app opens (or URI triggers) with share text pre-filled.
- [ ] Tap WhatsApp option — WhatsApp opens with share text pre-filled.
- [ ] Share text contains: poster name, skill level, location, date, time, cost, URL.
- [ ] Share text date is human-readable (e.g., "Thu, Apr 10"), not ISO format.
- [ ] Share text cost reflects current (discounted) price.

### Share on GroupCard:

- [ ] Share button works on GroupCard.
- [ ] Share text adapts for regular_game (no date/time/cost fields).

### Share from post detail page:

- [ ] On `/post/[Post A ID]` (authenticated), share button works identically to feed card.

### Mobile UX:

- [ ] Post detail page scrolls correctly if content exceeds viewport.
- [ ] Share fallback modal renders correctly on 390px — no content cut off.
- [ ] All touch targets minimum 44px (CTA button, share button, modal options).
- [ ] No horizontal scroll on any post detail page state.
- [ ] Loading spinner shown while post is fetching.
- [ ] Back navigation (browser back or swipe) works correctly from post detail to previous page.

---

## Summary of deliverables

After completing all seven passes, you should have:

1. A documented architecture decision on how unauthenticated users access post data (RLS policy or Edge Function).
2. A numbered list of all code quality issues found and fixed in Pass 1.
3. Test files in `/src/__tests__/`:
   - `post-detail.test.tsx`
   - `share-functionality.test.tsx`
   - `signup-redirect.test.ts`
   - `og-meta-tags.test.tsx`
4. All tests passing (`npx vitest run` — 0 failures).
5. Zero TypeScript errors (`npm run build` — clean).
6. Manual verification checklist completed with all items checked.
7. A noted limitation on OG meta tags in client-side rendered SPAs, with a recommended approach for V1.5.

If any test depends on a later phase, mark it as "deferred to Phase [X] eval."
