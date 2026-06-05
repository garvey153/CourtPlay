-- ============================================================
-- CourtPlay V1 — Initial Schema
-- ============================================================

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
  original_cost numeric(8,2),
  spots_total integer default 1,
  series_id uuid,
  notes text,
  status text default 'active' check (status in ('active','expired','deleted')),
  deleted_at timestamptz,
  deleted_by uuid references public.users,
  view_count integer default 0,
  expires_at timestamptz,
  preferred_days text[],
  preferred_times text[],
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
  sms_enabled boolean default false,
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

-- Responsiveness log
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

-- Post views
create table public.post_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users not null,
  post_id uuid references public.posts not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

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

-- USERS
create policy "Public users readable" on public.users
  for select using (deleted_at is null and is_suspended = false);

create policy "Users update own profile" on public.users
  for update using (auth.uid() = id);

create policy "Users insert own profile" on public.users
  for insert with check (auth.uid() = id);

create policy "Admins full access users" on public.users
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- POSTS
create policy "Signed-in users read posts" on public.posts
  for select using (auth.role() = 'authenticated' and status = 'active');

create policy "Users insert own posts" on public.posts
  for insert with check (auth.uid() = author_id);

create policy "Users update own posts" on public.posts
  for update using (auth.uid() = author_id);

create policy "Admins full access posts" on public.posts
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- CLAIMS
create policy "Users read own claims" on public.claims
  for select using (
    auth.uid() = claimer_id
    or exists (select 1 from public.posts where id = post_id and author_id = auth.uid())
  );

create policy "Signed-in users read claim status" on public.claims
  for select using (auth.role() = 'authenticated');

create policy "Users insert own claims" on public.claims
  for insert with check (auth.uid() = claimer_id);

create policy "Users update involved claims" on public.claims
  for update using (
    auth.uid() = claimer_id
    or exists (select 1 from public.posts where id = post_id and author_id = auth.uid())
  );

create policy "Admins full access claims" on public.claims
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- FOLLOWS
create policy "Signed-in users read follows" on public.follows
  for select using (auth.role() = 'authenticated');

create policy "Users insert own follows" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "Users delete own follows" on public.follows
  for delete using (auth.uid() = follower_id);

-- NOTIFY_ME
create policy "Users read own notify_me" on public.notify_me
  for select using (auth.uid() = user_id);

create policy "Users insert own notify_me" on public.notify_me
  for insert with check (auth.uid() = user_id);

create policy "Users delete own notify_me" on public.notify_me
  for delete using (auth.uid() = user_id);

-- NOTIFICATION_PREFERENCES
create policy "Users manage own notification_preferences" on public.notification_preferences
  for all using (auth.uid() = user_id);

-- REPORTS
create policy "Users insert own reports" on public.reports
  for insert with check (auth.uid() = reporter_id);

create policy "Admins full access reports" on public.reports
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- RESPONSIVENESS_LOG
create policy "Admins read responsiveness_log" on public.responsiveness_log
  for select using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- NOTIFICATIONS
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- POST_VIEWS
create policy "Users manage own post_views" on public.post_views
  for all using (auth.uid() = user_id);

-- COURTS
create policy "Signed-in users read courts" on public.courts
  for select using (auth.role() = 'authenticated' and active = true);

create policy "Admins full access courts" on public.courts
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- CUSTOM_COURT_SUBMISSIONS
create policy "Admins full access custom_court_submissions" on public.custom_court_submissions
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

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

-- Encrypt sensitive fields (phone, Venmo) via pgcrypto
-- Key is embedded in security definer function — not visible to regular users.
-- To rotate: deploy a new migration with a new key and re-encrypt existing values.
create or replace function encrypt_sensitive(p_value text)
returns text as $$
declare
  v_key bytea := '3d512aa86a126484694dbb5835ee5543'::bytea;
begin
  return encode(encrypt(p_value::bytea, v_key, 'aes'), 'base64');
end;
$$ language plpgsql security definer;

-- Decrypt sensitive fields (for post-approval screen)
create or replace function decrypt_sensitive(p_value text)
returns text as $$
declare
  v_key bytea := '3d512aa86a126484694dbb5835ee5543'::bytea;
begin
  return convert_from(
    decrypt(decode(p_value, 'base64'), v_key, 'aes'),
    'UTF8'
  );
end;
$$ language plpgsql security definer;
