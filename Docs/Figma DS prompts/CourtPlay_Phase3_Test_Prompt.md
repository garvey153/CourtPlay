# CourtPlay — Phase 3 Testing & Code Quality Audit

## How to use this prompt

Run this prompt in Claude Code after Phase 3 is complete. It performs two passes:

1. **Code quality audit** — Review all Phase 3 code for best practices, bugs, and spec compliance.
2. **Functional testing** — Write and run automated tests to validate every acceptance criterion.

Work through each section sequentially. Fix any issues found before moving to the next section. Do not skip ahead.

---

## Pre-flight checks

Before starting, confirm the following are in place. If any are missing, stop and fix them first.

1. Run `npm run build` — the project must compile with zero TypeScript errors and zero warnings.
2. Run `npx tsc --noEmit` — confirm no type errors across the project.
3. Confirm Supabase is running (local or hosted) and the database has the full schema applied, including:
   - `posts` table with all columns
   - `post_views` table with `unique(user_id, post_id)` constraint
   - `follows` table with `unique(follower_id, following_id)` constraint
   - `users` table with `onesignal_player_id` column
   - `courts` table populated with at least 3 test courts
   - `increment_view_count` RPC function
   - All RLS policies for `posts`, `post_views`, `follows`, `users`, `courts`
4. Confirm at least two test user accounts exist and can sign in.
5. Confirm at least 5 test posts exist in the database — mix of `sub_need` (various dates, including one today) and `regular_game` types.
6. Confirm at least one follow relationship exists between the two test users.

---

## Pass 1 — Code quality audit

Review every file touched or created in Phase 3. For each file, check the items below. Log any violations as a numbered list at the end of this pass with the file path, line number, and issue description.

### 1.1 File structure compliance

Verify the following files exist in the correct locations per the project file structure:

```
/src/components/app/SubCard.tsx
/src/components/app/GroupCard.tsx
/src/pages/Feed.tsx
/src/hooks/usePosts.ts
```

Check that no Phase 3 component was placed in `/src/components/ui/` — that directory is reserved for Untitled UI components and must not be edited.

### 1.2 TypeScript quality

For every `.ts` and `.tsx` file in Phase 3:

- [ ] No use of `any` type. Every variable, prop, parameter, and return type must be explicitly typed or correctly inferred. If `any` exists, replace it with a proper type or interface.
- [ ] All Supabase query results are typed with interfaces that match the database schema. Check that `posts` rows are typed with a `Post` interface, `users` rows with a `User` interface, etc.
- [ ] No type assertions (`as`) used to silence errors — each assertion must be justified.
- [ ] All component props defined with a named interface (e.g., `interface SubCardProps`), not inline.
- [ ] All event handlers are correctly typed (e.g., `React.MouseEvent<HTMLButtonElement>`), not `any` or untyped.
- [ ] Enums or union types used for constrained values: post status (`'active' | 'expired' | 'deleted'`), post type (`'sub_need' | 'regular_game'`), format, skill level. No raw strings passed where a union type should be used.
- [ ] Null/undefined checks present before accessing optional fields (e.g., `game_date`, `game_time`, `original_cost`, `photo_url`).

### 1.3 React best practices

For every React component in Phase 3:

- [ ] No inline function definitions in JSX props (e.g., `onClick={() => handleClick(id)}`). Extract to named handlers or use `useCallback` for functions passed as props to child components.
- [ ] No missing `key` props on list-rendered elements. Keys must be stable IDs (e.g., `post.id`), never array indices.
- [ ] No state updates inside `useEffect` that could cause infinite re-render loops. Every `useEffect` must have a correct dependency array.
- [ ] `useMemo` used for expensive computations (e.g., filtering/sorting the post list). Verify the dependency array is correct.
- [ ] Components do not re-render unnecessarily — the feed list should use `React.memo` on SubCard and GroupCard to prevent re-renders when the parent feed state changes but individual card data hasn't.
- [ ] No direct DOM manipulation. All UI state managed through React state.
- [ ] Loading states shown during async operations (Supabase queries). Verify an Untitled UI Spinner or skeleton is rendered while the feed loads.
- [ ] Error states handled — if the feed query fails, show an error message with a retry option, not a blank screen or console error.

### 1.4 Design token compliance

For every component in Phase 3:

- [ ] No hardcoded hex colors anywhere. All colors must reference CSS custom properties from `tokens.css` (e.g., `var(--color-primary)`, `var(--color-amber)`, `var(--color-red)`).
- [ ] If using Tailwind classes for color, verify they map to the token layer, not Tailwind defaults. For example, `text-green-700` is wrong — it should use a custom class or inline `style` referencing `--color-primary`.
- [ ] Font family uses `var(--font-sans)`, not hardcoded `'Inter'`.
- [ ] Border radius uses `var(--radius-md)` or `var(--radius-lg)` or `var(--radius-pill)`, not hardcoded pixel values.
- [ ] Time pressure label colors verified: green (`--color-primary`) for >12h, amber (`--color-amber`) for 4–12h, red (`--color-red`) for <4h.
- [ ] Spots indicator uses amber (`--color-amber`) when exactly 1 spot remaining.
- [ ] Discount display uses gray with strikethrough for original price, green (`--color-primary`) for new price.

### 1.5 Supabase query quality

For every Supabase query in Phase 3:

- [ ] Feed query matches the spec exactly:
  ```sql
  order by posts.game_date asc nulls last, is_friend desc, posts.created_at desc
  ```
- [ ] Feed query filters `status = 'active'` AND `(expires_at is null or expires_at > now())`.
- [ ] Feed query does NOT return posts where `deleted_at is not null`.
- [ ] The `is_friend` subquery uses `exists(select 1 from follows where follower_id = [current_user_id] and following_id = posts.author_id)` — not a join, not a mutual check.
- [ ] All queries wrapped in try/catch with user-facing error toasts on failure.
- [ ] No raw SQL strings — use Supabase client `.from().select()` syntax or RPC calls.
- [ ] `increment_view_count` called via `.rpc('increment_view_count', { p_post_id: post.id })`, not a direct `.update()` on `view_count`.
- [ ] `post_views` upsert uses `.upsert()` with `onConflict: 'user_id,post_id'` to avoid duplicate row errors.

### 1.6 Real-time subscription

- [ ] Supabase real-time subscription exists on the `posts` table for `INSERT`, `UPDATE`, and `DELETE` events.
- [ ] Subscription is set up in a `useEffect` with a proper cleanup function that calls `.unsubscribe()` on unmount.
- [ ] When a real-time event fires, the feed updates without a full page refresh — the post list state is updated in place.
- [ ] Subscription does not cause unnecessary re-renders of the entire feed — only the affected card should update.

### 1.7 View tracking implementation

- [ ] View count increment (`increment_view_count` RPC) fires when a post card enters the viewport, not on every render of the parent feed component.
- [ ] An Intersection Observer or equivalent is used to detect when a card enters the viewport.
- [ ] The `post_views` upsert is debounced (300ms minimum) to prevent rapid duplicate calls during fast scrolling.
- [ ] View tracking does not fire for the currently authenticated user's own posts (a poster viewing their own post should not inflate the count).
- [ ] View tracking gracefully handles errors — a failed view count increment must not break the feed or show an error toast to the user.

### 1.8 Filter implementation

- [ ] Skill level filter is multi-select chips — not a dropdown.
- [ ] Date range filter uses a date range picker component.
- [ ] Format filter is multi-select chips.
- [ ] Location/court filter is a searchable dropdown.
- [ ] Filters persist within session via React state (not URL params, not localStorage).
- [ ] A "Clear filters" option exists and resets all filters to their default (unselected) state.
- [ ] Filters are applied client-side against the fetched post list, or as query parameters that modify the Supabase query. Either approach is acceptable, but the behavior must be correct.
- [ ] When all filters result in zero posts, the empty state message is shown.

### 1.9 Accessibility

- [ ] All interactive elements (buttons, links, chips) are keyboard-navigable.
- [ ] All images and avatars have `alt` text.
- [ ] Filter chips use appropriate ARIA roles (`role="checkbox"` or `role="option"`).
- [ ] The feed list uses `role="list"` and each card uses `role="listitem"`, or equivalent semantic HTML (`<ul>` / `<li>`).
- [ ] Color is not the only indicator of state — time pressure labels, spots indicator, and friend badges also use text labels, not just color.
- [ ] Touch targets are minimum 44px on mobile (verify on 390px viewport).

### 1.10 Mobile-first layout

- [ ] Feed renders correctly at 390px viewport width with no horizontal scroll.
- [ ] Post cards use the full width with appropriate padding (16px horizontal is standard).
- [ ] Bottom navigation bar does not obscure the last feed item — verify there is sufficient bottom padding on the feed list.
- [ ] Filters UI does not overflow on small screens — chips wrap to the next line or scroll horizontally within a container.
- [ ] All text is readable at default font size — no text smaller than 12px.

---

## Pass 2 — Functional testing

Install a test framework if not already present. Preferred: Vitest (already compatible with the Vite setup) + React Testing Library for component tests.

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Add to `vite.config.ts` if not already present:
```ts
/// <reference types="vitest" />
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
}
```

Create `/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

Create the following test files and run them with `npx vitest run`. All tests must pass.

### 2.1 Feed query and sort order — `/src/__tests__/feed-sort.test.ts`

Write a test file that validates the feed sort logic. Use mock data — do not depend on a live Supabase connection for unit tests.

```
Test: "sub_need posts sort by soonest game_date first"
  - Create 3 mock sub_need posts with dates: tomorrow, today, next week
  - Apply the sort function
  - Assert order: today, tomorrow, next week

Test: "friend posts sort before non-friend posts within the same date"
  - Create 2 mock sub_need posts with the same game_date
  - One is from a followed user (is_friend = true), one is not
  - Apply the sort function
  - Assert: friend post appears first

Test: "regular_game posts sort after all sub_need posts"
  - Create 1 mock regular_game post (game_date = null) and 2 sub_need posts
  - Apply the sort function
  - Assert: regular_game post is last

Test: "within regular_game posts, friend posts sort first"
  - Create 2 mock regular_game posts, one from a friend
  - Apply the sort function
  - Assert: friend regular_game post appears first

Test: "expired posts are excluded from feed"
  - Create 1 active post and 1 post with status = 'expired'
  - Apply the filter
  - Assert: only active post remains

Test: "posts past their expires_at are excluded"
  - Create 1 post with expires_at in the past
  - Apply the filter
  - Assert: post is excluded
```

### 2.2 SubCard component — `/src/__tests__/SubCard.test.tsx`

```
Test: "renders all required fields"
  - Render SubCard with a complete mock post
  - Assert visible: format badge, date + day, time, skill level badge, total players, location, poster name, spots indicator, cost, time-since-posted, view count

Test: "shows Friend badge when is_friend is true"
  - Render SubCard with is_friend = true
  - Assert: "Friend" pill badge is visible

Test: "does not show Friend badge when is_friend is false"
  - Render SubCard with is_friend = false
  - Assert: "Friend" pill badge is not in the DOM

Test: "shows discount treatment when original_cost exists"
  - Render SubCard with cost = 20, original_cost = 40
  - Assert: original price (40) has strikethrough styling, new price (20) is shown

Test: "does not show discount treatment when original_cost is null"
  - Render SubCard with cost = 40, original_cost = null
  - Assert: no strikethrough, single price displayed

Test: "shows amber spots indicator when 1 spot remaining"
  - Render SubCard with spots_total = 4, 3 pending/approved claims
  - Assert: spots indicator shows "1/4 available" and uses amber color

Test: "shows Pending badge when any claim has status pending"
  - Render SubCard with one pending claim
  - Assert: "Pending" badge visible

Test: "shows time pressure label with correct colors"
  - Render SubCard with game_date = today, game_time = 14 hours from now
  - Assert: label shows "Game in 14h", green color
  - Render with game_time = 8 hours from now
  - Assert: label shows "Game in 8h", amber color
  - Render with game_time = 2 hours from now
  - Assert: label shows "Game in 2h", red color

Test: "does not show time pressure label for games more than 24h away"
  - Render SubCard with game_date = tomorrow (>24h away)
  - Assert: no time pressure label in the DOM

Test: "shows Notify me link when all spots are filled"
  - Render SubCard where spots_available = 0
  - Assert: "Notify me if this opens up" link is visible

Test: "does not show Notify me link when spots are available"
  - Render SubCard where spots_available > 0
  - Assert: "Notify me" link is not in the DOM
```

### 2.3 GroupCard component — `/src/__tests__/GroupCard.test.tsx`

```
Test: "renders all required fields"
  - Render GroupCard with complete mock data
  - Assert visible: format interest badges, skill level, preferred days/times, preferred courts, poster name, brief note

Test: "shows contact info for users with complete profiles"
  - Render GroupCard with viewer who has photo + skill_level set
  - Assert: poster email and phone visible

Test: "hides contact info for users without complete profiles"
  - Render GroupCard with viewer who has no photo and no headline
  - Assert: contact info not visible

Test: "shows share and report buttons"
  - Render GroupCard
  - Assert: share button and ⋯ menu are present
```

### 2.4 Feed filters — `/src/__tests__/feed-filters.test.tsx`

```
Test: "skill level filter reduces visible posts"
  - Render feed with posts at skill levels 3.0, 3.5, 4.0
  - Select "3.5" skill level filter
  - Assert: only 3.5 posts visible

Test: "multiple skill level filters combine with OR logic"
  - Select "3.0" and "4.0"
  - Assert: posts at 3.0 and 4.0 visible, 3.5 hidden

Test: "format filter works correctly"
  - Render feed with point_play and clinic posts
  - Select "Point play" filter
  - Assert: only point_play posts visible

Test: "location filter works correctly"
  - Render feed with posts at different courts
  - Select a specific court
  - Assert: only posts at that court visible

Test: "Clear filters resets all selections"
  - Apply skill level and format filters
  - Click "Clear filters"
  - Assert: all posts visible, all filter chips deselected

Test: "filters persist when new posts arrive via real-time"
  - Apply a filter
  - Simulate a real-time post insert
  - Assert: filter is still active, new post only shows if it matches the filter

Test: "empty state shown when filters match zero posts"
  - Apply a filter that matches no posts
  - Assert: empty state message visible
```

### 2.5 Empty state and welcome card — `/src/__tests__/feed-states.test.tsx`

```
Test: "empty state shown when no posts exist"
  - Render feed with zero posts
  - Assert: "No open spots right now — be the first to post one." message visible
  - Assert: "Find a Sub" CTA button present

Test: "welcome card shown for new users"
  - Render feed as user with 0 follows and <2 posts in feed
  - Assert: welcome card visible

Test: "welcome card not shown for established users"
  - Render feed as user with 3 follows
  - Assert: welcome card not visible

Test: "welcome card dismissable"
  - Render feed with welcome card visible
  - Dismiss the card
  - Assert: card removed from DOM
  - Assert: localStorage contains dismissed_welcome flag

Test: "welcome card stays dismissed on re-render"
  - Set dismissed_welcome in localStorage
  - Render feed as new user
  - Assert: welcome card not visible
```

### 2.6 View tracking — `/src/__tests__/view-tracking.test.ts`

```
Test: "increment_view_count RPC called when card enters viewport"
  - Mock Supabase .rpc()
  - Simulate a SubCard entering the viewport via Intersection Observer
  - Assert: .rpc('increment_view_count', { p_post_id }) was called once

Test: "post_views upsert called when card enters viewport"
  - Mock Supabase .upsert()
  - Simulate a SubCard entering the viewport
  - Assert: .upsert() called on post_views table with correct user_id and post_id

Test: "view tracking is debounced"
  - Simulate a card entering and leaving the viewport rapidly 5 times within 300ms
  - Assert: RPC called at most once

Test: "view tracking does not fire for own posts"
  - Set current user ID to match the post's author_id
  - Simulate card entering viewport
  - Assert: RPC not called

Test: "view tracking failure does not break the feed"
  - Mock .rpc() to reject with an error
  - Simulate card entering viewport
  - Assert: no error toast shown, feed still renders correctly
```

### 2.7 Real-time updates — `/src/__tests__/feed-realtime.test.tsx`

```
Test: "new post appears in feed without page refresh"
  - Render feed with existing posts
  - Simulate a Supabase real-time INSERT event with a new post
  - Assert: new post card appears in the feed at the correct sort position

Test: "updated post reflects changes without page refresh"
  - Render feed with an existing post (cost = 40)
  - Simulate a Supabase real-time UPDATE event changing cost to 20
  - Assert: post card shows updated cost

Test: "deleted post is removed from feed without page refresh"
  - Render feed with an existing post
  - Simulate a Supabase real-time UPDATE event changing status to 'deleted'
  - Assert: post card removed from feed

Test: "real-time subscription is cleaned up on unmount"
  - Render feed, then unmount the component
  - Assert: .unsubscribe() was called on the channel
```

---

## Pass 3 — Run tests and fix

1. Run all tests: `npx vitest run`
2. If any tests fail, fix the code (not the test) unless the test itself has a bug.
3. After all tests pass, run `npm run build` again to confirm zero TypeScript errors.
4. Run `npx vitest run` one final time to confirm all tests still pass after fixes.

---

## Pass 4 — Manual verification checklist

After all automated tests pass, run the app locally (`npm run dev`) and manually verify in Chrome DevTools at 390px viewport width:

- [ ] Feed loads with a spinner/skeleton, then shows posts.
- [ ] Posts are sorted correctly: soonest date first, friends within each date tier first, regular_game posts at the bottom.
- [ ] SubCard shows all fields: format badge, date, time, skill level, total players, location, poster name, spots indicator, cost, time-since-posted, view count.
- [ ] Friend badge appears on posts from followed users only.
- [ ] Time pressure label appears on posts with games within 24h, with correct color thresholds.
- [ ] Discount treatment shows strikethrough original price and green new price.
- [ ] Spots indicator turns amber at 1 remaining.
- [ ] GroupCard shows format interests, skill level, preferred days/times, courts, poster name, note.
- [ ] GroupCard shows contact info only to users with a complete profile.
- [ ] All four filter types work: skill level, date range, format, location.
- [ ] "Clear filters" resets all selections.
- [ ] Filters persist when scrolling.
- [ ] Empty state shown when no posts match filters.
- [ ] Welcome card appears for new users, dismisses, and stays dismissed.
- [ ] View count increments when scrolling a card into view (verify in Supabase dashboard).
- [ ] A `post_views` row is created when viewing a card (verify in Supabase dashboard).
- [ ] Creating a new post in another tab appears in the feed without refreshing.
- [ ] No horizontal scroll on 390px viewport.
- [ ] Bottom nav does not cover the last feed card.
- [ ] All touch targets are at least 44px.

---

## Summary of deliverables

After completing all four passes, you should have:

1. A numbered list of all code quality issues found and fixed in Pass 1.
2. Test files created in `/src/__tests__/` covering all Phase 3 acceptance criteria.
3. All tests passing (`npx vitest run` — 0 failures).
4. Zero TypeScript errors (`npm run build` — clean).
5. Manual verification checklist completed with all items checked.

If any acceptance criterion cannot be verified because it depends on a later phase (e.g., Claim button behavior depends on Phase 4), note it as "deferred to Phase [X]" and move on.
