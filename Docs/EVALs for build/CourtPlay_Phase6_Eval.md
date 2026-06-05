# CourtPlay — Phase 6 Eval: Friends & Social Feed

## How to use this eval

Run this prompt in Claude Code after Phase 6 is complete. It validates user search, the follow/unfollow system, the profile page, suggested follows during onboarding, and — critically — the integration between the follows graph and the feed sort order from Phase 3. The follow system is the foundation for friend expiry alerts (Phase 7), friend badges, and eventually the V1.5 mutual connection upgrade, so correctness here matters.

The eval has eight passes:

1. **Code quality audit** — Review all Phase 6 code for correctness, security, and best practices.
2. **User search tests** — Query behavior, result rendering, edge cases.
3. **Follow/unfollow tests** — State machine, database operations, UI updates.
4. **Profile page tests** — Field rendering, follow state, privacy boundaries, active posts.
5. **Suggested follows and onboarding tests** — Algorithm correctness, deduplication, empty states.
6. **Feed integration tests** — Friend-first sort verification with the follows table populated.
7. **Run tests and fix.**
8. **Manual verification** — Visual/UX checklist in a 390px mobile viewport.

Work through each pass sequentially. Fix issues before proceeding.

---

## Pre-flight checks

Confirm the following before starting. If any are missing, stop and fix them first.

1. `npm run build` compiles with zero TypeScript errors and zero warnings.
2. `npx tsc --noEmit` passes with no type errors.
3. Phases 3–5 evals pass completely.
4. Supabase database has the full schema applied with all RLS policies, including:
   - `follows` table with `unique(follower_id, following_id)` constraint
   - RLS policies: authenticated users can read all follows, insert own follows, delete own follows
   - `users` table with all profile fields
5. Test data exists:
   - **User A** — has a complete profile: photo, headline "Tennis addict", skill_level "3.5", court_preferences set, new_to_westport = false. Has 3 active posts.
   - **User B** — has a complete profile: no photo, headline set, skill_level "4.0", new_to_westport = true. Has 1 active post.
   - **User C** — has a minimal profile: first_name and skill_level only. No photo, no headline. Has 0 posts.
   - **User D** — suspended user (is_suspended = true).
   - **User E** — soft-deleted user (deleted_at set).
   - **User F** — complete profile, skill_level "3.5", same court_preferences as User A. Used for suggested follows testing.
   - Follow relationships: User A follows User B. User B follows User A. User C follows nobody. User F follows User B.
6. At least 5 active posts exist across Users A, B, and F with varying game dates — needed for feed sort verification.

---

## Pass 1 — Code quality audit

Review every file created or modified in Phase 6. Log violations as a numbered list.

### 1.1 File structure compliance

Verify the following files exist in the correct locations:

```
/src/pages/Profile.tsx               (or /src/pages/Profile/index.tsx)
/src/components/app/UserSearchInput.tsx  (or similar)
/src/components/app/UserListItem.tsx     (or similar — search result row)
/src/components/app/FollowButton.tsx     (or similar)
/src/components/app/SuggestedFollows.tsx  (or similar)
/src/hooks/useFollows.ts
```

Confirm no Phase 6 code was placed in `/src/components/ui/`.

### 1.2 TypeScript quality

For every `.ts` and `.tsx` file in Phase 6:

- [ ] No `any` types.
- [ ] A `Follow` interface exists matching the schema: `id, follower_id, following_id, created_at`.
- [ ] User search results are typed with the `User` interface — not `any[]` or untyped Supabase responses.
- [ ] The profile page route parameter (`:id`) is typed and validated as a UUID before querying.
- [ ] Follow/unfollow functions accept typed user IDs — `(targetUserId: string)` or equivalent, not untyped params.
- [ ] The `useFollows` hook returns typed state: `{ following: string[], isFollowing: (userId: string) => boolean, follow: (userId: string) => Promise<void>, unfollow: (userId: string) => Promise<void> }` or equivalent.
- [ ] Suggested follows query results are typed and deduplicated at the type level.

### 1.3 One-directional follow enforcement

This is the most important architectural check in Phase 6.

- [ ] The follow system is strictly one-directional. User A following User B does NOT imply User B follows User A.
- [ ] No code anywhere checks for mutual follows, reciprocal relationships, or bidirectional follow state. The word "mutual" should not appear in any V1 code except comments referencing V1.5.
- [ ] The feed sort query uses `exists(select 1 from follows where follower_id = [current_user] and following_id = posts.author_id)` — not a mutual check, not a join that requires both directions.
- [ ] The "Friend" badge on feed cards is based on "current user follows this poster" — not "poster follows current user" and not "both follow each other."
- [ ] The Follow/Following button label reflects the current user's action: "Follow" means "I am not following this person" and "Following" means "I am following this person." It does NOT reflect whether the other person follows you back.

### 1.4 Search query security

- [ ] The user search query uses parameterized queries or the Supabase client's `.ilike()` method — never string interpolation or concatenation of the search term into SQL.
- [ ] The search query filters out `deleted_at is not null` and `is_suspended = true` users.
- [ ] The search query does NOT return sensitive fields: phone, venmo_handle, email (beyond what's needed). If using `select *`, verify RLS or app-layer filtering strips sensitive columns before rendering.
- [ ] Search results are limited (`limit 20` per spec). No unbounded queries.
- [ ] Empty search input does not trigger a query or returns no results — not the entire user list.

### 1.5 Profile page privacy boundaries

- [ ] **Follower count**: shown as a number only (e.g., "12 followers"). The individual follower list is PRIVATE — no API call fetches or renders the list of who follows this user.
- [ ] **Following list**: visible to all signed-in users. Renders as a list of user cards with name, avatar, skill level.
- [ ] **Phone and Venmo handle**: NOT visible on the profile page. These are only revealed on the post-approval screen (Phase 4). Verify no decryption call is made on the profile page.
- [ ] **Email**: NOT visible on the profile page (it is only shown on GroupCard contact info for complete-profile users, per Phase 3 spec).
- [ ] **Active posts by this user**: only posts with `status = 'active'` shown. No expired, deleted, or draft posts.
- [ ] **Suspended/deleted user profiles**: if a user navigates to `/profile/[suspended_user_id]`, show a "User not found" or equivalent message — do not show the suspended user's profile.

### 1.6 React best practices

- [ ] Search input is debounced (300ms minimum) to avoid firing a Supabase query on every keystroke.
- [ ] Follow/unfollow uses optimistic UI: the button state updates immediately on tap, then reverts if the Supabase call fails.
- [ ] The FollowButton does not cause a re-render of the entire profile page or feed — only the button and related counts update.
- [ ] The profile page shows a loading state (spinner/skeleton) while user data is being fetched.
- [ ] The profile page handles fetch errors: shows an error message with retry, not a blank screen.
- [ ] The unfollow confirmation modal uses an Untitled UI Dialog — not `window.confirm()`.
- [ ] Search results list uses stable `key` props (user ID), not array indices.
- [ ] `useEffect` for fetching profile data has the correct dependency array (only `id` from route params).

### 1.7 Supabase query quality

- [ ] User search query matches spec:
  ```sql
  select * from users
  where (first_name ilike '%query%' or last_name_initial ilike '%query%')
    and deleted_at is null
    and is_suspended = false
  limit 20
  ```
- [ ] Follow insert uses `.insert({ follower_id: currentUserId, following_id: targetUserId })` — the current user is always the `follower_id`.
- [ ] Unfollow uses `.delete()` with a match on both `follower_id` and `following_id` — not just one column.
- [ ] Follower count uses a `count` query or aggregation — not fetching all follower rows and counting client-side.
- [ ] Following list query is paginated or limited to a reasonable number (e.g., 50).
- [ ] All queries wrapped in try/catch with user-facing error toasts on failure.

### 1.8 Design token compliance

- [ ] No hardcoded hex colors in any Phase 6 component.
- [ ] Follow button uses `--color-primary` background when in "Follow" state, outline/secondary style when in "Following" state.
- [ ] "New to Westport" tag uses a distinct badge color from the token palette (not the same as friend badge or skill level badge).
- [ ] User search input uses token-consistent styling (border: `--color-border`, focus ring: `--color-primary`).
- [ ] Profile page layout uses `--color-background-secondary` for the header/card area.
- [ ] Skill level badge on profile uses the same style as on SubCard/GroupCard (consistency check).

---

## Pass 2 — User search tests

Create `/src/__tests__/user-search.test.tsx`.

```
Test: "search by first name returns matching users"
  - Mock Supabase query
  - Search for "Jan" (matches User A's first name, assuming "Jane")
  - Assert: User A appears in results
  - Assert: result shows avatar, name, skill level, Follow button

Test: "search by last name initial returns matching users"
  - Search for "D" (matches a user with last_name_initial = "D")
  - Assert: matching user appears in results

Test: "search is case-insensitive"
  - Search for "jane" (lowercase)
  - Assert: User A ("Jane") appears in results

Test: "search excludes suspended users"
  - Search for User D's first name
  - Assert: User D (suspended) does NOT appear in results

Test: "search excludes soft-deleted users"
  - Search for User E's first name
  - Assert: User E (deleted) does NOT appear in results

Test: "search results limited to 20"
  - Mock 25 matching users
  - Assert: only 20 returned

Test: "empty search input returns no results"
  - Search for "" (empty string)
  - Assert: no query fired OR empty results returned
  - Assert: no error shown

Test: "search with no matches shows empty state"
  - Search for "Zzzzxxx" (no match)
  - Assert: "No users found" or equivalent message shown

Test: "search input is debounced"
  - Type "Jan" rapidly (one char at a time within 300ms)
  - Assert: Supabase query called at most once (after debounce settles), not 3 times

Test: "search result shows New to Westport tag when set"
  - User B has new_to_westport = true
  - Assert: "New to Westport" tag visible in search result for User B

Test: "search result shows Follow button for unfollowed users"
  - Current user does NOT follow User C
  - Assert: "Follow" button shown for User C in results

Test: "search result shows Following button for followed users"
  - Current user (A) follows User B
  - Assert: "Following" button shown for User B in results

Test: "search does not return current user"
  - Current user searches for their own name
  - Assert: current user does NOT appear in their own search results

Test: "search result tapping user name navigates to profile"
  - Tap on a user's name in search results
  - Assert: navigates to /profile/[user_id]
```

---

## Pass 3 — Follow / unfollow tests

Create `/src/__tests__/follow-unfollow.test.ts`.

### 3.1 Follow

```
Test: "follow inserts row into follows table"
  - User A follows User C (currently not following)
  - Assert: .insert() called on follows table with follower_id = User A, following_id = User C
  - Assert: button changes from "Follow" to "Following"

Test: "follow updates follower count on target profile"
  - User C had 0 followers
  - User A follows User C
  - Assert: follower count on User C's profile shows 1

Test: "following count updates on current user's profile"
  - User A was following 1 user (User B)
  - User A follows User C
  - Assert: following count on User A's profile shows 2

Test: "duplicate follow is idempotent"
  - User A already follows User B
  - User A attempts to follow User B again
  - Assert: no error, no duplicate row (unique constraint enforced)
  - Assert: button stays as "Following"

Test: "cannot follow yourself"
  - User A attempts to follow User A
  - Assert: follow blocked — either button not rendered on own profile, or action returns gracefully with no insert

Test: "cannot follow suspended user"
  - User A attempts to follow User D (suspended)
  - Assert: follow blocked or User D's profile not accessible

Test: "cannot follow deleted user"
  - User A attempts to follow User E (soft-deleted)
  - Assert: follow blocked or User E's profile not accessible

Test: "follow is one-directional"
  - User A follows User C
  - Assert: row exists with follower_id = A, following_id = C
  - Assert: NO row exists with follower_id = C, following_id = A
  - Assert: User C's feed does NOT show User A's posts as friend posts (unless C independently follows A)
```

### 3.2 Unfollow

```
Test: "unfollow shows confirmation modal"
  - User A taps "Following" button on User B's profile
  - Assert: confirmation modal appears — "Unfollow [User B's name]?"

Test: "confirming unfollow deletes row from follows table"
  - User A confirms unfollow of User B
  - Assert: .delete() called on follows with follower_id = A, following_id = B
  - Assert: button changes from "Following" to "Follow"

Test: "cancelling unfollow does nothing"
  - User A taps "Following" then cancels the confirmation
  - Assert: no delete called
  - Assert: button stays as "Following"

Test: "unfollow decrements follower count on target profile"
  - User B had 2 followers (A and F)
  - User A unfollows User B
  - Assert: follower count on User B's profile shows 1

Test: "unfollow decrements following count on current user's profile"
  - User A was following 2 users
  - User A unfollows User B
  - Assert: following count on User A's profile shows 1

Test: "no notification sent on unfollow"
  - User A unfollows User B
  - Assert: no notification dispatch function called for User B

Test: "unfollow of user not followed is a no-op"
  - User A attempts to unfollow User C (not following)
  - Assert: no error, no crash
```

### 3.3 Optimistic UI

```
Test: "follow button updates immediately before Supabase confirms"
  - Mock Supabase .insert() with a 2-second delay
  - User A taps "Follow" on User C
  - Assert: button immediately shows "Following" (before the 2s delay resolves)

Test: "follow button reverts on Supabase error"
  - Mock Supabase .insert() to reject with an error
  - User A taps "Follow" on User C
  - Assert: button briefly shows "Following", then reverts to "Follow"
  - Assert: error toast shown

Test: "unfollow button reverts on Supabase error"
  - Mock Supabase .delete() to reject with an error
  - User A taps "Following" on User B (confirms modal)
  - Assert: button briefly shows "Follow", then reverts to "Following"
  - Assert: error toast shown
```

---

## Pass 4 — Profile page tests

Create `/src/__tests__/profile-page.test.tsx`.

### 4.1 Field rendering

```
Test: "profile shows all public fields for complete profile"
  - Render /profile/[User A ID]
  - Assert visible: avatar/photo, first name + last name initial, headline, skill level badge, court preferences, Follow/Following button
  - Assert NOT visible: email, phone, Venmo handle

Test: "profile shows minimal fields for incomplete profile"
  - Render /profile/[User C ID] (no photo, no headline)
  - Assert visible: first name + last name initial, skill level badge
  - Assert: placeholder avatar shown (not broken image)
  - Assert: no headline section rendered (not an empty string or "null")

Test: "New to Westport tag shown when set"
  - Render /profile/[User B ID] (new_to_westport = true)
  - Assert: "New to Westport" tag visible

Test: "New to Westport tag NOT shown when false"
  - Render /profile/[User A ID] (new_to_westport = false)
  - Assert: "New to Westport" tag not in DOM
```

### 4.2 Follow state and counts

```
Test: "Follow button shown when not following this user"
  - User A views /profile/[User C ID] (not following)
  - Assert: "Follow" button visible

Test: "Following button shown when already following"
  - User A views /profile/[User B ID] (following)
  - Assert: "Following" button visible

Test: "No Follow button on own profile"
  - User A views /profile/me or /profile/[User A ID]
  - Assert: no Follow/Following button rendered

Test: "follower count displayed as number"
  - User B has 2 followers (A and F)
  - Render /profile/[User B ID]
  - Assert: "2 followers" (or "2") shown

Test: "follower list is NOT accessible"
  - Render /profile/[User B ID]
  - Assert: no expandable follower list, no link to "view followers", no individual follower names

Test: "following list is visible"
  - User A follows User B
  - Render /profile/[User A ID]
  - Assert: following list section shows User B (name, avatar, skill level)

Test: "following list visible to other signed-in users"
  - User C views /profile/[User A ID]
  - Assert: User C can see User A's following list
```

### 4.3 Active posts

```
Test: "active posts by this user shown on profile"
  - User A has 3 active posts
  - Render /profile/[User A ID]
  - Assert: 3 post cards rendered in the profile's posts section

Test: "expired and deleted posts NOT shown on profile"
  - User A also has expired or deleted posts in the database
  - Assert: only active posts shown

Test: "no posts section shows appropriate empty state"
  - User C has 0 posts
  - Render /profile/[User C ID]
  - Assert: "No active posts" or equivalent empty state — not a blank section
```

### 4.4 Report and navigation

```
Test: "report user option in ⋯ menu"
  - Render /profile/[User A ID] as User B
  - Assert: ⋯ menu contains "Report this user" option

Test: "report user not shown on own profile"
  - Render /profile/me
  - Assert: no ⋯ menu or no "Report" option

Test: "tapping poster name on feed card navigates to profile"
  - Render a SubCard for a post by User A
  - Tap User A's name
  - Assert: navigates to /profile/[User A ID]

Test: "suspended user profile returns not-found state"
  - Navigate to /profile/[User D ID] (suspended)
  - Assert: "User not found" or equivalent — not the suspended user's profile data

Test: "deleted user profile returns not-found state"
  - Navigate to /profile/[User E ID] (soft-deleted)
  - Assert: "User not found" or equivalent

Test: "invalid profile ID handled gracefully"
  - Navigate to /profile/not-a-uuid
  - Assert: "User not found" — no crash, no blank screen
```

---

## Pass 5 — Suggested follows tests

Create `/src/__tests__/suggested-follows.test.tsx`.

```
Test: "suggested follows appear during onboarding"
  - New user (User G) completes profile setup
  - User G's court_preferences overlap with User A and User F
  - Assert: suggested follows section appears after profile setup step
  - Assert: section title is "People you might know" or similar

Test: "suggestions based on shared follows (friends-of-friends)"
  - User G follows User B during onboarding search
  - User A and User F also follow User B
  - Assert: User A and User F appear in suggestions (they follow someone User G also follows)

Test: "suggestions based on shared court preferences"
  - User G sets court_preferences matching User A
  - Assert: User A appears in suggestions

Test: "current user excluded from suggestions"
  - Assert: User G does NOT appear in their own suggestions

Test: "already-followed users excluded from suggestions"
  - User G already followed User B in the search step
  - Assert: User B does NOT appear in suggestions

Test: "suspended users excluded from suggestions"
  - Assert: User D (suspended) never appears in suggestions

Test: "deleted users excluded from suggestions"
  - Assert: User E (soft-deleted) never appears in suggestions

Test: "suggestions limited to 10 results"
  - Mock 15 eligible users
  - Assert: at most 10 shown

Test: "suggestions deduplicated"
  - A user qualifies via both shared follows AND shared court preferences
  - Assert: that user appears only once in the list

Test: "empty suggestions handled gracefully"
  - New user with no follows and unique court preferences (no overlap)
  - Assert: suggestions section shows empty state ("No suggestions yet — try searching by name") or is hidden entirely
  - Assert: no error, onboarding can still proceed

Test: "follow button works within suggestions"
  - Tap "Follow" on a suggested user
  - Assert: follow inserted, button changes to "Following"
  - Assert: suggested list does not re-render and remove the just-followed user (user stays in list with "Following" state so the action feels stable)
```

---

## Pass 6 — Feed integration tests

Create `/src/__tests__/feed-follow-integration.test.tsx`.

These tests verify that the follow system from Phase 6 correctly integrates with the feed sort from Phase 3. This is the single most important cross-phase integration in V1.

### 6.1 Friend-first sort order

```
Test: "followed user's posts appear before non-followed within same date"
  - User A follows User B, does not follow User F
  - User B and User F both have posts on the same game_date
  - Render feed as User A
  - Assert: User B's post appears before User F's post within that date tier

Test: "unfollowing moves posts back to non-friend position"
  - User A follows User B (User B's posts are friend-sorted)
  - User A unfollows User B
  - Render feed as User A
  - Assert: User B's posts are now in recency order among non-friend posts, not friend-first

Test: "following a new user moves their posts to friend position"
  - User A does not follow User F, then follows User F
  - Render feed as User A
  - Assert: User F's posts now appear in friend-first position within their date tier
```

### 6.2 Friend badge

```
Test: "Friend badge appears on followed user's posts in feed"
  - User A follows User B
  - Render feed as User A
  - Assert: "Friend" pill badge visible on User B's posts
  - Assert: "Friend" pill badge NOT visible on User F's posts (not followed)

Test: "Friend badge disappears after unfollowing"
  - User A unfollows User B
  - Render feed as User A
  - Assert: "Friend" pill badge no longer visible on User B's posts
```

### 6.3 Edge cases

```
Test: "feed sort works when user follows nobody"
  - User C follows nobody
  - Render feed as User C
  - Assert: all posts sorted by game_date ASC, then created_at DESC (no friend layer applied)
  - Assert: no "Friend" badges anywhere

Test: "feed sort handles user following all posters"
  - User A follows every user with active posts
  - Render feed as User A
  - Assert: all posts have "Friend" badge
  - Assert: within each date tier, posts sorted by created_at DESC (since all are friends, recency breaks the tie)

Test: "feed real-time updates respect follow state"
  - User A follows User B
  - New post inserted by User B via real-time
  - Assert: new post appears with "Friend" badge at the correct sort position (friend-first within its date tier)

Test: "feed real-time updates for non-followed user"
  - New post inserted by User F (not followed by User A) via real-time
  - Assert: new post appears WITHOUT "Friend" badge, sorted by recency within its date tier
```

### 6.4 Cold-start feed behavior (from product plan)

```
Test: "friend-first sorting disabled when feed density is below threshold"
  - Mock feed with fewer than 5 active posts total
  - User A follows User B (User B has 1 of the 3 posts)
  - Render feed as User A
  - Assert: all posts sorted by game_date ASC, then created_at DESC — NO friend-first sorting
  - Assert: "Friend" badge still visible (the badge shows even without friend-sorting)

Test: "friend-first sorting enabled when feed density exceeds threshold"
  - Mock feed with 10+ active posts
  - User A follows User B
  - Render feed as User A
  - Assert: User B's posts sorted first within each date tier (friend-first sorting active)
```

---

## Pass 7 — Run tests and fix

1. Run all tests: `npx vitest run`
2. Fix code (not tests) for any failures, unless the test itself contains a bug.
3. After all tests pass, run `npm run build` to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time.

---

## Pass 8 — Manual verification checklist

Run the app locally (`npm run dev`) in Chrome DevTools at 390px viewport width.

### User search:

- [ ] Search input available on the profile page (or a dedicated "Find friends" section).
- [ ] Typing a name shows results after debounce — no results on every keystroke.
- [ ] Results show avatar, name, skill level, "New to Westport" tag (if applicable), and Follow/Following button.
- [ ] Tapping a user's name navigates to their profile.
- [ ] Searching for a suspended or deleted user returns no results.
- [ ] Searching for own name does not return self.
- [ ] Empty search shows no results (not the full user list).
- [ ] "No users found" message shown for queries with no matches.

### Follow / unfollow:

- [ ] Tapping "Follow" on a profile page changes button to "Following" immediately (optimistic).
- [ ] Tapping "Following" shows confirmation modal: "Unfollow [Name]?"
- [ ] Confirming unfollow changes button back to "Follow."
- [ ] Cancelling unfollow keeps "Following" state.
- [ ] Follower count updates on the target user's profile after follow/unfollow.
- [ ] Following count updates on own profile after follow/unfollow.
- [ ] No Follow button on own profile page.

### Profile page:

- [ ] `/profile/[User A ID]` shows: photo, name, headline, skill level, court preferences, follower count, following list, active posts.
- [ ] `/profile/[User B ID]` shows "New to Westport" tag.
- [ ] `/profile/[User C ID]` shows placeholder avatar (no photo), name, skill level only.
- [ ] Following list renders as tappable user cards.
- [ ] Follower count is a number only — no individual names listed.
- [ ] Phone, email, and Venmo handle are NOT visible on any profile page.
- [ ] ⋯ menu with "Report this user" is visible on other users' profiles.
- [ ] ⋯ menu not visible on own profile.
- [ ] Active posts section shows only active posts by this user.
- [ ] Navigating to a suspended or deleted user's profile shows "User not found."

### Suggested follows (onboarding):

- [ ] Sign up as a new test user.
- [ ] After profile setup, "People you might know" section appears.
- [ ] Suggested users are relevant (shared follows or shared court preferences).
- [ ] Follow button works within suggestions.
- [ ] If no suggestions exist, the section shows a helpful empty state or is hidden.
- [ ] Onboarding can proceed regardless of whether the user follows any suggestions.

### Feed integration:

- [ ] Sign in as User A. Verify User B's posts (followed) appear before User F's posts (not followed) within the same date tier.
- [ ] Verify "Friend" badge appears on User B's posts only.
- [ ] Follow User F from the feed (tap name → profile → follow). Return to feed.
- [ ] Verify User F's posts now have "Friend" badge and are sorted friend-first.
- [ ] Unfollow User F. Return to feed.
- [ ] Verify User F's posts no longer have "Friend" badge and are sorted by recency.
- [ ] Sign in as User C (follows nobody). Verify feed has no "Friend" badges and is sorted purely by date then recency.

### Follow from feed card:

- [ ] On any SubCard or GroupCard, tap the poster's name.
- [ ] Verify navigation to `/profile/[poster_id]`.
- [ ] Follow the poster from the profile page.
- [ ] Navigate back to feed. Verify "Friend" badge now appears on that poster's cards.

### Mobile UX:

- [ ] Search results list scrolls correctly on 390px viewport.
- [ ] Profile page scrolls correctly if content exceeds viewport.
- [ ] Following list scrolls correctly if many users followed.
- [ ] All touch targets minimum 44px (Follow button, search results, profile links).
- [ ] No horizontal scroll on any Phase 6 screen.
- [ ] Loading spinner shown while profile data fetches.
- [ ] Error state shown if profile fetch fails (not blank screen).
- [ ] Unfollow confirmation modal renders correctly on mobile — not cut off.

---

## Summary of deliverables

After completing all eight passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files in `/src/__tests__/`:
   - `user-search.test.tsx`
   - `follow-unfollow.test.ts`
   - `profile-page.test.tsx`
   - `suggested-follows.test.tsx`
   - `feed-follow-integration.test.tsx`
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. Manual verification checklist completed with all items checked.

If any test depends on a later phase (e.g., "Report this user" dispatching to the Phase 9 report flow), mark it as "deferred to Phase [X] eval."
