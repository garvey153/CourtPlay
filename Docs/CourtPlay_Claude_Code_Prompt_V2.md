# CourtPlay V1 — Claude Code Build Prompt

## How to use this prompt

This is a structured handoff document for Claude Code. Work through it **phase by phase**. Do not move to the next phase until the current one is complete and manually tested. At the start of each phase, read the full phase spec before writing any code.

### Testing protocol

After completing each phase, manually test every acceptance criterion before proceeding:

1. **Run the app locally** (`npm run dev`) and test each criterion in a mobile viewport (390px width in Chrome DevTools).
2. **Verify database state** in the Supabase dashboard — check that rows are inserted, RLS policies allow/block as expected, and encrypted fields are not stored as plaintext.
3. **Test auth boundaries** — attempt each action as both an authenticated and unauthenticated user. Verify protected routes redirect correctly.
4. **For scheduled cron jobs** (Phase 7+): test by calling the Edge Function directly via curl with the service role key. Verify deduplication by running the function twice and confirming no duplicate notifications.
5. **For notifications** (Phase 7+): verify delivery in both OneSignal dashboard (push) and Resend dashboard (email). Check that notification preferences are respected — a user with push disabled should not receive push.
6. If a phase's acceptance criteria cannot be fully tested because it depends on a later phase (e.g., claim flow notifications), note the dependency and revisit after the dependent phase is complete.

---

## Project overview

Build **CourtPlay** — a mobile-first Progressive Web App (PWA) for Westport, CT that replaces a chaotic WhatsApp tennis sub group. Players post sub needs, others browse and claim open spots, and payment is coordinated off-platform via Venmo in V1.

**One-line pitch:** "Find a tennis sub in Westport in under 10 minutes."

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript v5.9 + Vite |
| Styling | Tailwind CSS v4.2 |
| Design system | Untitled UI React (initialized via `npx untitledui@latest`) |
| Backend / database | Supabase (auth, PostgreSQL, real-time, file storage) |
| Auth | Supabase Auth — Google OAuth + email/password |
| Push notifications | OneSignal (free tier) |
| Email | Resend (transactional) |
| Hosting | Vercel |
| Domain | courtplay.com |

---

## Design system setup

Before writing any product code:

1. Run `npx untitledui@latest` and select the Vite starter kit.
2. Create `/src/styles/tokens.css` with the following CSS variable overrides:

```css
:root {
  --color-primary: #2D6A4F;
  --color-primary-hover: #245c43;
  --color-primary-light: #D8F3DC;
  --color-text-primary: #1B1B1B;
  --color-text-secondary: #6B7280;
  --color-text-tertiary: #9CA3AF;
  --color-background: #FFFFFF;
  --color-background-secondary: #F9FAFB;
  --color-border: #E5E7EB;
  --color-amber: #F59E0B;
  --color-red: #EF4444;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;
  --font-sans: 'Inter', sans-serif;
}
```

3. Import `tokens.css` before Untitled UI styles in `main.tsx`.
4. All product-specific components (SubCard, ClaimButton, etc.) must use these tokens — never hardcode hex colors.

---

## Database schema

Run these migrations in Supabase SQL editor before any phase begins.

```sql
-- Users (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users primary key,
  email text not null,
  first_name text not null,
  last_name_initial text not null,
  headline text,
  photo_url text,
  skill_level text check (skill_level in ('2.5','3.0','3.5','4.0','4.5','5.0')),
  court_preferences text[], -- array of court IDs
  pro_preference text,
  venmo_handle text, -- encrypted at app layer before insert
  phone text, -- encrypted at app layer before insert
  phone_verified boolean default false,
  new_to_westport boolean default false,
  is_admin boolean default false,
  is_suspended boolean default false,
  onesignal_player_id text,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- Courts (master list)
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Custom court submissions (for admin alert threshold)
create table public.custom_court_submissions (
  id uuid primary key default gen_random_uuid(),
  court_name text not null unique,
  submission_count integer default 1,
  last_submitted_at timestamptz default now(),
  alerted boolean default false
);

-- Posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users not null,
  author_type text default 'player' check (author_type in ('player','pro','club')),
  post_type text not null check (post_type in ('sub_need','regular_game')),
  format text check (format in ('point_play','clinic','lesson','round_robin','other')),
  total_players integer,
  game_date date,
  game_time time,
  skill_level text check (skill_level in ('2.5','3.0','3.5','4.0','4.5','5.0')),
  location text,
  court_id uuid references public.courts,
  custom_court text,
  pro_name text,
  cost numeric(8,2),
  original_cost numeric(8,2), -- set on first discount
  spots_total integer default 1,
  series_id uuid, -- links individual cards in a multi-date series
  notes text,
  status text default 'active' check (status in ('active','expired','deleted')),
  deleted_at timestamptz,
  deleted_by uuid references public.users,
  view_count integer default 0,
  expires_at timestamptz,
  preferred_days text[], -- for regular_game type
  preferred_times text[], -- for regular_game type
  created_at timestamptz default now()
);

-- Claims
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts not null,
  claimer_id uuid references public.users not null,
  status text default 'pending' check (status in ('pending','approved','rejected','unclaimed','cancelled')),
  rejection_reason text,
  reopen_note text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Follows (one-directional in V1)
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references public.users not null,
  following_id uuid references public.users not null,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

-- Notify me (watch a post for reopening)
create table public.notify_me (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users not null,
  post_id uuid references public.posts not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

-- Notification preferences
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users not null,
  notification_type text not null,
  push_enabled boolean default false,
  email_enabled boolean default true,
  sms_enabled boolean default false, -- V1.5
  unique(user_id, notification_type)
);

-- Reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users not null,
  target_type text not null check (target_type in ('post','user')),
  target_id uuid not null,
  reason text not null,
  note text,
  status text default 'pending' check (status in ('pending','dismissed','actioned')),
  reviewed_by uuid references public.users,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Responsiveness log (silent in V1, feeds V1.5 indicator)
create table public.responsiveness_log (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid references public.users not null,
  post_id uuid references public.posts not null,
  claim_id uuid references public.claims not null,
  event_type text check (event_type in ('responded','ignored')),
  response_time_hours numeric,
  created_at timestamptz default now()
);

-- Notifications (log of all sent notifications)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users not null,
  type text not null,
  post_id uuid references public.posts,
  claim_id uuid references public.claims,
  channel text not null check (channel in ('push','email','sms')),
  read boolean default false,
  created_at timestamptz default now()
);

-- Post views (per-user view tracking for price drop notifications and view counts)
create table public.post_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users not null,
  post_id uuid references public.posts not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.claims enable row level security;
alter table public.follows enable row level security;
alter table public.notify_me enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.reports enable row level security;
alter table public.responsiveness_log enable row level security;
alter table public.notifications enable row level security;
alter table public.post_views enable row level security;
alter table public.courts enable row level security;
alter table public.custom_court_submissions enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- USERS
-- Public: read non-deleted, non-suspended users
create policy "Public users readable" on public.users
  for select using (deleted_at is null and is_suspended = false);

-- Users can update their own profile
create policy "Users update own profile" on public.users
  for update using (auth.uid() = id);

-- Users can insert their own profile row (onboarding)
create policy "Users insert own profile" on public.users
  for insert with check (auth.uid() = id);

-- Admins: full access including suspended/deleted users
create policy "Admins full access users" on public.users
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- POSTS
-- All signed-in users can read active posts
create policy "Signed-in users read posts" on public.posts
  for select using (auth.role() = 'authenticated' and status = 'active');

-- Users can insert their own posts
create policy "Users insert own posts" on public.posts
  for insert with check (auth.uid() = author_id);

-- Users can update their own posts
create policy "Users update own posts" on public.posts
  for update using (auth.uid() = author_id);

-- Admins: full access on posts
create policy "Admins full access posts" on public.posts
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- CLAIMS
-- Users can read claims on their own posts or their own claims
create policy "Users read own claims" on public.claims
  for select using (
    auth.uid() = claimer_id
    or exists (select 1 from public.posts where id = post_id and author_id = auth.uid())
  );

-- Signed-in users can read claim counts for spot availability (limited fields handled at app layer)
create policy "Signed-in users read claim status" on public.claims
  for select using (auth.role() = 'authenticated');

-- Users can insert their own claims
create policy "Users insert own claims" on public.claims
  for insert with check (auth.uid() = claimer_id);

-- Users can update claims they're involved in (claimer unclaims, poster approves/rejects)
create policy "Users update involved claims" on public.claims
  for update using (
    auth.uid() = claimer_id
    or exists (select 1 from public.posts where id = post_id and author_id = auth.uid())
  );

-- Admins: full access on claims
create policy "Admins full access claims" on public.claims
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- FOLLOWS
-- Signed-in users can read follows (needed for friend badges and feed sort)
create policy "Signed-in users read follows" on public.follows
  for select using (auth.role() = 'authenticated');

-- Users can insert their own follows
create policy "Users insert own follows" on public.follows
  for insert with check (auth.uid() = follower_id);

-- Users can delete their own follows (unfollow)
create policy "Users delete own follows" on public.follows
  for delete using (auth.uid() = follower_id);

-- NOTIFY_ME
-- Users can read their own notify_me entries
create policy "Users read own notify_me" on public.notify_me
  for select using (auth.uid() = user_id);

-- Users can insert their own notify_me entries
create policy "Users insert own notify_me" on public.notify_me
  for insert with check (auth.uid() = user_id);

-- Users can delete their own notify_me entries
create policy "Users delete own notify_me" on public.notify_me
  for delete using (auth.uid() = user_id);

-- Edge Functions (service role) read notify_me for notifications — service role bypasses RLS

-- NOTIFICATION_PREFERENCES
-- Users can read and update their own notification preferences
create policy "Users manage own notification_preferences" on public.notification_preferences
  for all using (auth.uid() = user_id);

-- REPORTS
-- Users can insert their own reports
create policy "Users insert own reports" on public.reports
  for insert with check (auth.uid() = reporter_id);

-- Admins: full access on reports
create policy "Admins full access reports" on public.reports
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- RESPONSIVENESS_LOG
-- No user-facing reads in V1. Written by Edge Functions (service role bypasses RLS).
-- Admins can read for monitoring
create policy "Admins read responsiveness_log" on public.responsiveness_log
  for select using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- NOTIFICATIONS
-- Users can read their own notifications
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- Edge Functions insert notifications via service role (bypasses RLS)

-- POST_VIEWS
-- Users can read and insert their own post views
create policy "Users manage own post_views" on public.post_views
  for all using (auth.uid() = user_id);

-- COURTS
-- All signed-in users can read active courts
create policy "Signed-in users read courts" on public.courts
  for select using (auth.role() = 'authenticated' and active = true);

-- Admins: full access on courts
create policy "Admins full access courts" on public.courts
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- CUSTOM_COURT_SUBMISSIONS
-- Admins: full access
create policy "Admins full access custom_court_submissions" on public.custom_court_submissions
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- Edge Functions handle upsert via service role (bypasses RLS)

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Atomic view count increment
create or replace function increment_view_count(p_post_id uuid)
returns void as $$
begin
  update public.posts set view_count = view_count + 1 where id = p_post_id;
end;
$$ language plpgsql security definer;
```

---

## Phase 1a — Project scaffold and auth

**Goal:** Working app shell with authentication. User can sign up, sign in, and land on an empty protected feed page. Validate that Supabase auth works end-to-end before adding complexity.

### Tasks

1. Initialize project with Untitled UI Vite starter: `npx untitledui@latest`
2. Install dependencies: `@supabase/supabase-js`, `react-router-dom`
3. Configure Supabase client in `/src/lib/supabase.ts`
4. Set up environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Set up React Router with the following routes:
   - `/` — landing page (public, placeholder in 1a)
   - `/signin` — sign in
   - `/signup` — sign up
   - `/onboarding` — profile setup (post-auth, pre-feed) — placeholder in 1a
   - `/feed` — main feed (protected, empty state only)
   - `/post/new` — create post (protected, placeholder)
   - `/post/:id` — post detail / deep link (semi-public — see Phase 5)
   - `/profile/:id` — user profile (protected, placeholder)
   - `/profile/me` — own profile + settings (protected, placeholder)
   - `/activity` — my posts + claims (protected, placeholder)
   - `/admin` — admin dashboard (protected, is_admin only, placeholder)
6. Build auth flow:
   - Google OAuth via Supabase
   - Email + password via Supabase
   - On successful auth, redirect to `/feed` (onboarding redirect added in Phase 1b).
7. Build a minimal protected feed page that confirms auth state: show "Welcome, [email]" and a sign-out button. This validates the full auth round-trip.
8. Build protected route wrapper: redirect unauthenticated users to `/signin`.

### Acceptance criteria
- User can sign up with Google or email
- User lands on a protected feed page showing auth confirmation
- Unauthenticated routes redirect to `/signin`
- Supabase auth session persists across page refresh

---

## Phase 1b — Onboarding, navigation, and PWA

**Goal:** Full onboarding flow, navigation bars, and PWA install experience. User completes profile and lands on the feed.

### Tasks

1. Install additional dependencies: `@onesignal/react-onesignal`, `vite-plugin-pwa`
2. Set up additional environment variable: `VITE_ONESIGNAL_APP_ID`
3. Configure PWA: add `manifest.json` and service worker registration in `vite.config.ts` using `vite-plugin-pwa`
4. Update auth flow: on successful auth, check if user has a profile row. If not, redirect to `/onboarding`. If yes, redirect to `/feed`.
5. Build onboarding screen:
   - Step 1: Required fields (first name, last name initial, skill level)
   - Step 2: Optional fields (photo, headline, court preferences, pro preference)
   - Step 3: Contact + payment (phone with privacy note, Venmo handle with privacy note)
   - Step 4: Notification preferences (push toggle, email toggle)
   - Step 5: Find friends (search + follow — basic version, full search in Phase 6)
   - ToS + Privacy Policy acceptance checkbox on Step 1. Block progression if not accepted.
   - Encrypt phone and Venmo handle before storing via Supabase RPC functions (`encrypt_sensitive`) — see implementation note #1. Do not use client-side encryption.
6. Build bottom navigation bar: Feed, My Activity, Profile (3 tabs)
7. Build top navigation bar: CourtPlay wordmark left, "Find a Sub" green pill button right
8. Add iOS "Add to Home Screen" prompt after first sign-in (dismissable inline card, not modal)

### Acceptance criteria
- User completes onboarding and lands on feed
- Profile row created in Supabase with all required fields
- Phone and Venmo stored encrypted via pgcrypto RPCs
- PWA manifest valid and installable on iOS Safari
- Navigation bars render correctly on 390px viewport
- Onboarding redirect works for new users; returning users skip to feed

---

## Phase 2 — Post creation

**Goal:** Authenticated users can create both post types. Posts appear in the database.

### Tasks

1. Build **"Find a Sub" post creation form** (Post Type 1 — Individual Sub Need):
   - Format (required dropdown): Point play, Clinic, Lesson, Round robin, Other event
   - Total players (required number input): default 4
   - Date (required date picker — single or multi-select for series)
   - Time (required time picker)
   - Skill level required (required dropdown — same NTRP list)
   - Location / court (required — searchable dropdown from courts table + "Add custom court" option)
   - Pro name (optional text input)
   - Cost (required — number input with $ prefix)
   - Number of spots open (default 1, stepper up to 8)
   - Notes (optional, 100 char max with counter)
   - Multi-date mode: toggle to select multiple dates. Each date generates a separate post row with a shared `series_id` (new UUID generated at submit time).
   - On submit: insert post row(s). Show success toast. Redirect to feed.
   - Rate limit check: if user already has 5 active posts, show inline message and block submission.

2. Build **"Looking for a Regular Game" form** (Post Type 2):
   - Format (multi-select checkboxes): same format options
   - Preferred group size (optional number input)
   - Skill level (required dropdown)
   - Preferred days (multi-select: Mon–Sun)
   - Preferred times (multi-select: Morning, Midday, Afternoon, Evening)
   - Preferred courts (multi-select from courts list)
   - Brief note (optional, 150 char max)
   - Expires in 30 days automatically (set `expires_at = now() + interval '30 days'`)

3. Build **custom court handling**:
   - "Add custom court" option in court dropdown opens a text input
   - Custom court name stored on `posts.custom_court`, not in courts table
   - On each custom court submission, upsert `custom_court_submissions` — increment count. If count reaches 3 and `alerted = false`, send email to admin and set `alerted = true`.

4. Build **post editing**:
   - Edit button on own posts in My Activity
   - Before any claims: all fields editable
   - After first claim exists: only cost and notes editable. All other fields show as locked with tooltip: "Cancel and repost to change game details."
   - Cost edit triggers notification to all pending/approved claimers (implement notification hook — see Phase 7)
   - Series edit: prompt "Apply to this post only or all future posts in series?" Do not apply to posts with approved claims.

### Acceptance criteria
- Both post types created successfully and stored in Supabase
- Multi-date series creates multiple linked post rows
- Custom court submission increments count correctly
- Rate limit of 5 active posts enforced
- Edit restrictions enforced based on claim state

---

## Phase 3 — Feed

**Goal:** Authenticated users see a live feed of posts, sorted correctly, with filters.

### Tasks

1. Build **feed query** with sort logic:
   ```sql
   select posts.*, users.first_name, users.photo_url,
     exists(select 1 from follows where follower_id = auth.uid() and following_id = posts.author_id) as is_friend
   from posts
   join users on posts.author_id = users.id
   where posts.status = 'active'
     and (posts.expires_at is null or posts.expires_at > now())
   order by
     -- Sub needs (with game_date) sort first by soonest game date
     -- Regular game posts (game_date is null) sort after all dated posts
     posts.game_date asc nulls last,
     is_friend desc,
     posts.created_at desc
   ```
   **Sort behavior by post type:**
   - `sub_need` posts: sorted by soonest `game_date`, then friend-first within each date, then recency.
   - `regular_game` posts: `game_date` is null, so they appear after all dated sub needs (via `NULLS LAST`). Within this group, friend posts first, then by recency. This means regular game posts are always visible but never push urgent sub needs down the feed.

2. Build **SubCard component** (Post Type 1):
   - Format badge (colored pill per format type)
   - Date + day of week (e.g. "Thu, Apr 3")
   - Time (e.g. "9:00 AM")
   - Skill level badge
   - Total players (e.g. "4 players")
   - Location
   - Poster first name + avatar
   - Spots indicator: "X/Y available" — amber color when X = 1
   - Cost — if discounted: original price in gray with strikethrough, new price in green
   - Time-since-posted (e.g. "2h ago")
   - View count (e.g. "14 views") — increment on card render via Supabase RPC
   - "Friend" pill badge if `is_friend = true`
   - Time pressure label: shown when `game_date = today` and within 24h — "Game in Xh" — green > 12h, amber 4–12h, red < 4h
   - "Claim" green pill button (see Phase 4 for full claim flow)
   - "Notify me if this opens up" link — shown when all spots pending or claimed
   - Share button (⬆ icon) — see Phase 5
   - Report button (⋯ menu → Report) — see Phase 8
   - Pending badge: shown when any spot has status = pending

3. Build **GroupCard component** (Post Type 2):
   - Format interest badges
   - Skill level, preferred days/times, preferred courts
   - Poster name + avatar
   - Brief note
   - Contact info (email + phone if set) — shown only to users with a complete profile (headline or photo set AND skill level set)
   - Share button, Report button

4. Build **feed filters**:
   - Skill level (multi-select chips)
   - Date range (date range picker)
   - Format (multi-select chips)
   - Location/court (searchable dropdown)
   - Filters persist within session via React state
   - "Clear filters" option

5. Build **feed empty state**: "No open spots right now — be the first to post one." with a "Find a Sub" CTA button.

6. Build **onboarding welcome card**: shown to new users with < 1 follow and < 2 posts in feed. Explains how feed works. Dismissable. Store `dismissed_welcome` in localStorage.

7. Wire up **Supabase real-time** subscription on the posts table so new posts and status changes update the feed without a page refresh.

8. Build **post view tracking**:
   - On post card render (SubCard or GroupCard entering viewport): call the `increment_view_count` RPC function (defined in the initial migration) to atomically increment `posts.view_count`.
   - Upsert a row into `post_views` table `(user_id, post_id)` to track per-user views. Use a debounced function (300ms) to avoid rapid duplicate calls on scroll. This table is used in Phase 8 for price drop notifications to prior viewers.

### Acceptance criteria
- Feed shows all active posts
- Sort order: soonest game date first, friend posts within date tier first
- Filters work correctly and persist within session
- View count increments on card render via RPC
- Per-user view records written to `post_views` table
- Real-time updates reflect new posts and status changes
- Welcome card shown to new users and dismissable

---

## Phase 4 — Claim flow

**Goal:** Users can claim spots. Posters can approve or reject. Full state machine implemented.

### Tasks

1. Build **claim submission**:
   - "Claim" button on SubCard triggers a confirmation modal: "Claim this spot at [Location] on [Date] for $[Cost]?"
   - On confirm: check for time conflict (existing pending/approved claim on same date+time for this user). If conflict exists, show inline message: "You already have a pending claim on [Date] at [Time]. Back out of that claim first."
   - If no conflict: insert claim row with status = 'pending'. Reduce available spot count display.
   - Update post card to show "Pending" badge.
   - Trigger notification to poster (see Phase 7).

2. Build **poster approval flow**:
   - In My Activity > My Posts, each post with pending claims shows a "Review claims" section.
   - Each pending claimer shown with: name, photo, skill level, "Friend" tag if followed.
   - Poster actions: Approve or Reject.
   - On Approve: update claim status to 'approved'. Update spot count. If all spots filled, gray out post card. Trigger approval notification to claimer with Venmo deep link. Log to responsiveness_log.
   - On Reject: update claim status to 'rejected'. Spot reopens. Trigger rejection notification with optional reason (preset options: Wrong skill level, Already filled, Other). Log to responsiveness_log.

3. Build **post-approval screen**:
   - Shown to both poster and claimer after approval.
   - Poster sees: claimer name, phone (decrypted), pre-filled Venmo deep link — `venmo://paycharge?txn=charge&recipients=[claimer_venmo]&amount=[cost]&note=CourtPlay+sub+fee+[date]+[location]`
   - Claimer sees: poster name, phone (decrypted), Venmo handle, amount owed, reminder to pay.
   - Both: game date, time, location summary.

4. Build **unclaim flow**:
   - "Back out" button on claimed/pending spots in My Activity > My Claims.
   - Confirmation modal: "Are you sure? The poster will be notified and the spot will reopen."
   - On confirm: update claim status to 'unclaimed'. Notify poster.

5. Build **reopen flow** (Scenario B):
   - "Reopen spot" button on approved claims in My Posts view.
   - On confirm: update claim status to 'cancelled'. Add note to claim row. Add flag to claimer history: "Spot reopened by poster after approval."
   - Optional private note input for admin visibility.

6. Build **spot counter logic**:
   - `spots_available = posts.spots_total - count(claims where status in ('pending','approved'))`
   - Spots indicator shows X/Y. Amber when X = 1. Grays out card when X = 0.

7. Build **"Notify me if this opens up"** feature:
   - Link shown when X = 0 (all spots filled or pending).
   - On tap: insert row into `notify_me`. Show confirmation: "We'll notify you if a spot opens up."
   - When a claim is unclaimed, rejected, or cancelled: query `notify_me` for this post and send notification to all watchers.

### Acceptance criteria
- Full claim state machine works: open → pending → approved/rejected → unclaimed/cancelled
- Time conflict check prevents double-claiming same time slot
- Venmo deep link opens Venmo app with pre-filled fields
- Phone numbers decrypted and shown only on post-approval screen
- Spot counter accurate in real time
- "Notify me" alerts fire on spot reopening

---

## Phase 5 — Deep links and sharing

**Goal:** Posts have shareable URLs. Logged-out users see a preview. Share sheet triggers on share button tap.

> **Note:** This phase makes `/post/:id` work for unauthenticated users before the full landing page is built in Phase 12. Logged-out users who hit a deep link will see the post preview and a sign-up CTA — they do not need the marketing landing page to convert. The `/` route remains a placeholder until Phase 12.

### Tasks

1. Build **post detail page** at `/post/:id`:
   - Fetch post by ID from Supabase. This page is semi-public — no auth required to view.
   - If user is authenticated: show full post card with claim button.
   - If user is not authenticated: show post preview (format, date, time, skill level, location, cost, spots available) with a prominent CTA: "Sign in to claim this spot" — links to `/signup?redirect=/post/:id`. After sign-up and onboarding, redirect back to the post.
   - If post is expired or deleted: show "This spot is no longer available. Browse open spots →" with link to `/feed` (if authenticated) or `/signup` (if not).
   - Add `<meta>` Open Graph tags (og:title, og:description, og:url) so shared links render a preview in iMessage, WhatsApp, and social platforms. Use post details (format, date, location, cost) for the description.

2. Build **share functionality** on post cards:
   - Share button (⬆ icon) on every SubCard and GroupCard.
   - On tap: use Web Share API if available (`navigator.share`). Falls back to a share sheet modal with options: Copy link, Share to iMessage (sms: URI), Share to WhatsApp (`https://wa.me/?text=...`).
   - URL format: `https://courtplay.com/post/:id`
   - Share text: "[Name] needs a [skill level] tennis sub at [Location] on [Date] at [Time]. $[Cost]. Claim it on CourtPlay: [URL]"

### Acceptance criteria
- `/post/:id` renders correctly for authenticated and unauthenticated users
- Share button works on iOS Safari (Web Share API) and falls back to modal
- WhatsApp and iMessage share links pre-populate with post details
- Sign-in redirect preserves post URL and lands user on post after auth

---

## Phase 6 — Friends and social feed

**Goal:** Users can follow other players. Friend posts surface first in the feed.

### Tasks

1. Build **user search**:
   - Search input in the "Find friends" section of onboarding and on the profile page.
   - Query: `select * from users where (first_name ilike '%query%' or last_name_initial ilike '%query%') and deleted_at is null and is_suspended = false limit 20`
   - Show results as user list with avatar, name, skill level, "New to Westport" tag if set, Follow/Following button.

2. Build **follow/unfollow**:
   - Follow: insert row into `follows`. Button changes to "Following."
   - Unfollow: delete row from `follows`. Confirmation: "Unfollow [Name]?" No notification sent to the unfollowed user.
   - Following count shown on own profile.

3. Build **profile page** (`/profile/:id`):
   - Avatar, name, headline, skill level, court preferences, "New to Westport" tag.
   - Follow/Following button.
   - Follower count (number only — individual list is private).
   - Following list (visible to all signed-in users).
   - Active posts by this user.
   - "Report this user" option (⋯ menu).

4. Build **suggested follows** during onboarding:
   - After profile setup, show: "People you might know" — users who share mutual follows (users who follow someone the new user also follows, or users in the same court preferences).
   - Query: `select distinct u.* from users u join follows f on f.following_id = u.id where f.follower_id in (select following_id from follows where follower_id = auth.uid()) and u.id != auth.uid() limit 10`

5. Verify **feed sort** is working correctly with the follows table populated.

### Acceptance criteria
- User can search for and follow/unfollow other users
- Profile page shows correct data and follow state
- Feed correctly surfaces followed users' posts first within each date tier
- "Friend" badge appears on feed cards from followed users
- Suggested follows shown during onboarding

---

## Phase 7 — Notifications

**Goal:** Push and email notifications fire correctly for all triggers. Users can configure preferences per channel.

### Tasks

1. Set up **OneSignal**:
   - Initialize OneSignal in `main.tsx` with app ID from env var.
   - On first push opt-in, store OneSignal player ID on the user's Supabase row (add `onesignal_player_id` column).
   - Request push permission contextually: (a) after user creates first post, (b) after user views a post without claiming — show inline prompt: "Get notified when prices drop or new spots open at your skill level."

2. Set up **Resend** email:
   - Create Supabase Edge Function: `send-email` — accepts `{to, subject, html}` and calls Resend API.
   - Create email templates for each notification type (plain HTML, mobile-responsive, CourtPlay branding minimal in V1).

3. Build **notification preferences UI** in Settings:
   - List all notification types with push and email toggles per type.
   - Save to `notification_preferences` table.
   - Default: email enabled for all types. Push disabled until opted in.

4. Build **notification dispatch function** — Supabase Edge Function `send-notification`:
   - Accepts `{user_id, notification_type, data}`.
   - Looks up user's `notification_preferences` for this type.
   - If push enabled and `onesignal_player_id` set: call OneSignal API.
   - If email enabled: call `send-email` Edge Function.
   - Log to `notifications` table.

5. Wire up all notification triggers:

   | Trigger | Function call location |
   |---|---|
   | Claim submitted | After claim insert |
   | Claim approved | After claim status update to 'approved' |
   | Claim rejected | After claim status update to 'rejected' |
   | Claimer backed out | After claim status update to 'unclaimed' |
   | Cost changed | After post cost update |
   | 12h nudge (no response) | Scheduled Supabase cron job |
   | 48h nudge (unfilled) | Scheduled Supabase cron job |
   | Price drop (prior viewer) | After post cost update — query view history |
   | Spot reopened (notify_me) | After claim cancelled/rejected — query notify_me |
   | Game reminder (day before) | Scheduled Supabase cron job |
   | Friend expiry alert (4h) | Scheduled Supabase cron job |

6. Build **scheduled cron jobs** as Supabase Edge Functions with pg_cron:

   ```sql
   -- 12h nudge: claims pending > 12h
   select cron.schedule('12h-claim-nudge', '0 * * * *', $$
     select net.http_post(
       url := 'https://[project].supabase.co/functions/v1/nudge-unresponded-claims',
       headers := '{"Authorization": "Bearer [service_role_key]"}'
     )
   $$);

   -- Friend expiry alert: unfilled posts within 4h of game time
   select cron.schedule('friend-expiry-alert', '0 * * * *', $$
     select net.http_post(
       url := 'https://[project].supabase.co/functions/v1/friend-expiry-alerts',
       headers := '{"Authorization": "Bearer [service_role_key]"}'
     )
   $$);

   -- Auto-expire posts after game date/time passes
   select cron.schedule('auto-expire-posts', '*/15 * * * *', $$
     update public.posts
     set status = 'expired'
     where status = 'active'
       and post_type = 'sub_need'
       and (game_date + game_time) < now()
   $$);

   -- Auto-expire regular_game posts after 30 days
   select cron.schedule('expire-regular-game-posts', '0 0 * * *', $$
     update public.posts
     set status = 'expired'
     where status = 'active'
       and post_type = 'regular_game'
       and expires_at < now()
   $$);
   ```

7. Build **friend expiry alert Edge Function**:
   - Finds all `sub_need` posts where: `status = 'active'`, `game_date + game_time` is between `now()` and `now() + 4 hours`, and there are no approved claims for all spots.
   - For each post, queries `follows` to find all followers of the poster.
   - Deduplicates against `notifications` table (type = 'friend_expiry', post_id, user_id) — only send once per post per follower.
   - Sends notification to each follower via `send-notification`.

### Acceptance criteria
- All notification triggers fire correctly
- Users can toggle push and email per notification type in settings
- OneSignal push notifications receive on iOS home screen
- Email notifications arrive with correct content
- Scheduled jobs run on schedule and do not duplicate notifications
- Friend expiry alert deduplication works correctly

---

## Phase 8 — Discount, urgency, and post lifecycle

**Goal:** Posters can discount posts. Urgency signals display correctly. Posts expire cleanly.

### Tasks

1. Build **discount mechanic**:
   - "Reduce price" button on active posts in My Activity > My Posts.
   - Input: new price (must be lower than current cost).
   - On save: update `posts.cost`. If `original_cost` is null, set `original_cost = old cost`.
   - Post card updates: show original_cost crossed out in gray (`line-through text-gray-400`), new cost in green.
   - Trigger "price drop" notification to all users with `notify_me` entries on this post AND all users who have viewed this post (query from `post_views` table built in Phase 3).

2. Build **time pressure label**:
   - Calculate hours until game: `(game_date + game_time) - now()`.
   - If < 24h: show "Game in Xh" label on card.
   - Color: green (> 12h), amber (`--color-amber`, 4–12h), red (`--color-red`, < 4h).

3. Build **48h unfilled nudge**:
   - Edge Function: finds active `sub_need` posts where `game_date - now() < 48h` and `spots_available > 0`.
   - Sends push notification to poster: "Your spot at [Location] on [Date] hasn't been claimed yet. Consider reducing the price to attract a sub."
   - Deduplicated — sent once per post.

4. Build **cancellation flow** with refund note:
   - Poster can cancel any active post from My Activity > My Posts.
   - Confirmation modal: "Cancel this post? All pending and approved claimers will be notified." + "If payment has already been made via Venmo, please coordinate directly with your sub to arrange a refund."
   - On confirm: soft-delete post (status = 'deleted'). Notify all pending/approved claimers.

### Acceptance criteria
- Discount updates correctly and shows visual treatment on card
- Price drop notification fires to prior viewers and notify_me watchers
- Time pressure label color changes at correct thresholds
- 48h nudge sends once per post and does not repeat
- Post cancellation notifies all claimers and shows Venmo refund reminder

---

## Phase 9 — Reporting and safety

**Goal:** Users can report posts and other users. Reports route to admin.

### Tasks

1. Build **report post flow**:
   - ⋯ menu on every post card (authenticated users only).
   - "Report this post" option opens a bottom sheet modal.
   - Reason options (radio): Spam, Inappropriate content, Incorrect information, Other.
   - Optional note text area (150 char max).
   - On submit: insert row into `reports` table. Show confirmation: "Thanks for your report. Our team will review it."
   - Reporter remains anonymous to the reported user.

2. Build **report user flow**:
   - ⋯ menu on every profile page.
   - Same options and flow as report post.
   - `target_type = 'user'`, `target_id = profile user's id`.

3. No user-facing consequence in V1 — all actioning happens via admin panel (Phase 10).

### Acceptance criteria
- Report flow works for both posts and users
- Reports inserted correctly into `reports` table
- Confirmation shown after submission
- No notification sent to reported user

---

## Phase 10 — Admin dashboard

**Goal:** Admin users can manage posts, users, claims, courts, and view reports and analytics.

**Access control:** Route `/admin` protected by `is_admin = true` check. Redirect non-admins to `/feed`.

### Tasks

1. Build **admin layout**: sidebar navigation with sections: Posts, Users, Claims, Courts, Reports, Analytics.

2. Build **Posts panel**:
   - Paginated table: all posts (active, expired, deleted), filterable by status/date/user/format.
   - Actions per post: View, Edit (any field), Soft-delete, Force-expire.
   - All admin edits logged with `deleted_by` / timestamp.

3. Build **Users panel**:
   - Paginated table: all users, filterable by status, join date, report count.
   - Actions per user: View profile, Suspend (toggle `is_suspended`), Delete (soft), Reset password (trigger Supabase password reset email), Grant/revoke admin (`is_admin` toggle — only visible to existing admins).
   - Suspended users see login blocked message.

4. Build **Claims panel**:
   - Paginated table: all claims, filterable by status/date/user.
   - Admin action: Cancel claim (with notification to both parties).
   - View responsiveness_log data per poster.

5. Build **Courts panel**:
   - View and edit master court list (add, edit, deactivate).
   - Custom court submissions alert queue — shows pending alerts (submission_count >= 3, alerted = true). Admin can add to master list or dismiss.

6. Build **Reports panel**:
   - Queue of pending reports with target context (post preview or user profile), reporter note, timestamp.
   - Actions: Dismiss (no action), Remove content (soft-delete post or suspend user), Escalate (flag for further review).
   - On action: update `reports.status`, `reviewed_by`, `reviewed_at`.
   - If content removed: notify reported user — "Your post was removed for violating community guidelines."

7. Build **Analytics dashboard**:
   - Key metrics cards: total users, active users (last 7 days), posts created (last 7 days), successful matches (approved claims, last 7 days), push opt-in rate, email open rate (from Resend webhooks if available).
   - Funnel table: sign-ups → profile complete → first follow → first post/claim → first match.
   - Recent report activity count.
   - Custom court submission alert count.

### Acceptance criteria
- Admin route accessible only to `is_admin = true` users
- All CRUD operations on posts, users, and claims work correctly
- Soft deletes preserve data integrity
- Report actioning updates status and optionally notifies reported user
- Analytics metrics load correctly

---

## Phase 11 — My Activity and post history

**Goal:** Users can view and manage all their posts and claims in one place.

### Tasks

1. Build **My Activity screen** with two tabs: "My Posts" and "My Claims."

2. **My Posts tab**:
   - All posts by current user: active, pending (has claims), claimed, completed (expired with claims), expired (no claims).
   - Per active post: spots summary, edit button, cancel button, "Review claims" section if claims pending.
   - Per expired/completed post: read-only summary. Stays in history permanently.
   - Series posts: show as group with "X of Y dates" and bulk cancel option.

3. **My Claims tab**:
   - All claims by current user grouped by status: Pending, Approved (upcoming), Completed, Backed out.
   - Per pending claim: "Back out" button.
   - Per approved claim: game summary, poster contact details, Venmo handle + pre-filled link.
   - Completed claims: read-only. If claim has a "spot reopened by poster" flag, show neutral note: "The poster reopened this spot after approving your claim."

### Acceptance criteria
- All post and claim states display correctly
- Edit and cancel flows trigger from My Posts
- Back out flow triggers from My Claims
- Venmo deep link available on approved claims
- History flags visible in claimer's own view only

---

## Phase 12 — Landing page and PWA polish

**Goal:** Public landing page complete. PWA install experience polished. App is production-ready.

### Tasks

1. Build **landing page** at `/`:
   - Headline: "Find a tennis sub in Westport in under 10 minutes."
   - Subheadline: brief explanation of how it works (post, browse, claim, play).
   - How it works: 3-step visual (post your spot → browse open games → claim and play).
   - Social proof section: placeholder for early testimonials / match count.
   - Primary CTA: "Get started" → `/signup`.
   - Secondary: "Sign in" → `/signin`.
   - Footer: ToS link, Privacy Policy link, contact email.

2. Build **ToS and Privacy Policy pages** at `/terms` and `/privacy`:
   - Simple self-written V1 versions covering: data collected (email, phone, Venmo handle), how it's used, user rights, contact info.
   - Linked from sign-up form and footer.

3. **PWA polish**:
   - Verify `manifest.json` has correct `name`, `short_name`, `icons` (192px and 512px), `display: standalone`, `theme_color`, `background_color`.
   - Service worker caches app shell for offline resilience.
   - iOS "Add to Home Screen" prompt card shown after first sign-in (not on every visit).
   - Verify push notification permission prompt works on iOS 16.4+ (requires HTTPS + home screen install).

4. **Mobile UX polish**:
   - All touch targets minimum 44px.
   - No horizontal scroll on 390px viewport.
   - Bottom nav does not obscure content (add bottom padding to feed).
   - Forms scroll correctly when keyboard opens on iOS.
   - Loading states on all async actions (Untitled UI Spinner component).
   - Error states on all form submissions.
   - Toast notifications for success actions (Untitled UI Toast component).

5. **Performance**:
   - Run Lighthouse PWA audit. Target 90+ on Performance, Accessibility, Best Practices.
   - Lazy load post cards below the fold.
   - Paginate feed (20 posts per page, infinite scroll).

### Acceptance criteria
- Landing page renders correctly on mobile and desktop
- ToS and Privacy Policy pages exist and are linked correctly
- PWA installs on iOS Safari and appears as standalone app
- Push notifications work from home screen install
- Lighthouse PWA score 90+
- No horizontal scroll on 390px viewport
- All touch targets pass 44px minimum

---

## Environment variables required

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ONESIGNAL_APP_ID=
SUPABASE_SERVICE_ROLE_KEY= (Edge Functions only — never in frontend)
RESEND_API_KEY= (Edge Functions only)
VITE_APP_URL=https://courtplay.com
```

---

## File structure

```
/src
  /components
    /ui/          ← Untitled UI components (CLI-generated, do not edit)
    /app/         ← CourtPlay-specific components (SubCard, ClaimButton, etc.)
    /layout/      ← TopNav, BottomNav, AdminLayout
  /pages
    Landing.tsx
    SignIn.tsx
    SignUp.tsx
    Onboarding.tsx
    Feed.tsx
    PostNew.tsx
    PostDetail.tsx
    Profile.tsx
    Activity.tsx
    Admin/
      index.tsx
      Posts.tsx
      Users.tsx
      Claims.tsx
      Courts.tsx
      Reports.tsx
      Analytics.tsx
  /lib
    supabase.ts
    onesignal.ts
    venmo.ts       ← deep link generator
  /hooks
    useAuth.ts
    usePosts.ts
    useClaims.ts
    useNotifications.ts
    useFollows.ts
  /styles
    tokens.css
    global.css
  /supabase
    /functions/
      send-notification/
      send-email/
      nudge-unresponded-claims/
      friend-expiry-alerts/
      48h-unfilled-nudge/
      game-reminders/
```

---

## Important implementation notes

1. **Encryption:** Phone numbers and Venmo handles must be encrypted at the database layer using Supabase's `pgcrypto` extension — **not** in the frontend. Enable pgcrypto (`create extension if not exists pgcrypto;`) and use `pgp_sym_encrypt(value, key)` / `pgp_sym_decrypt(value::bytea, key)` with a symmetric key stored as a Supabase secret (vault or Edge Function env var). Create two Supabase RPC functions — `encrypt_sensitive(value text)` and `decrypt_sensitive(value bytea)` — that wrap pgcrypto calls so the encryption key never leaves the server. The frontend sends raw values via these RPCs; it never handles the key. Decrypt only when rendering the post-approval screen for the relevant parties via an Edge Function that checks claim status before returning decrypted values.

2. **RLS is the security layer:** All sensitive data access must be controlled by Supabase Row Level Security policies. Never rely solely on frontend checks for security.

3. **Soft deletes everywhere:** Posts, users, and claims are never hard-deleted. Always set `deleted_at` and `status = 'deleted'`. Admin queries can see deleted records; all user-facing queries filter `deleted_at is null`.

4. **One-directional follows in V1:** The follows table is intentionally one-directional. Do not build mutual connection logic — that comes in V1.5. The feed sort query uses `exists(select 1 from follows...)` not a mutual check.

5. **No SMS in V1:** The `sms_enabled` column in `notification_preferences` exists for schema continuity but is always `false` in V1. Do not wire up any Twilio integration.

6. **Responsiveness log is silent:** The `responsiveness_log` table is written to but never read in V1 UI. Do not surface any responsiveness indicator to users.

7. **Admin route security:** The `/admin` route must check `is_admin` via a fresh Supabase query on every load — not from cached state. A compromised JWT should not be able to access admin.

8. **Venmo deep link format:**
   ```
   venmo://paycharge?txn=charge&recipients=[venmo_handle]&amount=[cost]&note=CourtPlay%20sub%20fee%20[encoded_date]%20at%20[encoded_location]
   ```
   Falls back to `https://venmo.com/[venmo_handle]` if the Venmo app is not installed. **Note:** The web fallback intentionally does not pre-fill the amount — this is a Venmo platform limitation, not a bug. Do not attempt to work around it.

9. **Series IDs:** When a user creates multiple post cards from the date multi-select, generate one UUID for `series_id` at submit time and assign it to all posts in that batch. This enables bulk operations (cancel all in series, edit all in series).

10. **Post view counting:** Use a Supabase RPC function to increment `view_count` atomically. Do not update it directly from the client to avoid race conditions.

11. **Error handling:** All Supabase mutations must use try/catch with user-facing error toasts (Untitled UI Toast component). Edge Function calls should retry once on 5xx responses before showing an error. Network failures should show an inline retry prompt — never fail silently. Form submissions should disable the submit button during loading and re-enable on error.

12. **Testing:** There is no automated test suite in V1. Quality is maintained through manual testing against acceptance criteria after each phase (see Testing Protocol above). For database operations, verify state in the Supabase dashboard. For scheduled functions, test via direct curl invocation. Prioritize testing on iOS Safari in a 390px viewport — this is the primary usage environment.
