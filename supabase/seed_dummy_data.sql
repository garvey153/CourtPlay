-- ============================================================
-- CourtPlay — DEV/QA dummy data (15 users + 20 posts)
-- ============================================================
-- Purpose: populate the feed with a realistic spread of posts for design/QA —
-- past AND upcoming dates, every skill level, all 10 courts, and every play type.
--
-- NOT a migration: this lives outside supabase/migrations/ on purpose so it
-- never runs against production automatically. Apply it manually against a dev
-- project (Supabase dashboard → SQL Editor → paste + run, or `psql`/CLI).
--
-- Idempotent: every row uses a fixed UUID with `on conflict do nothing`, so it
-- is safe to run repeatedly. To remove the data, run the DELETE block at the
-- bottom (commented out).
--
-- These users never authenticate — they only exist so posts have authors and
-- the feed renders. game_date is relative to current_date, so dates stay
-- "past" / "upcoming" no matter when you run this.
-- ============================================================

-- ------------------------------------------------------------
-- 1) auth.users — FK target for public.users (minimal rows).
-- ------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000'::uuid, u.id, 'authenticated', 'authenticated', u.email, now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values
    ('d0000000-0000-0000-0000-000000000001'::uuid, 'olivia.r@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000002'::uuid, 'liam.k@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000003'::uuid, 'emma.t@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000004'::uuid, 'noah.b@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000005'::uuid, 'ava.m@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000006'::uuid, 'sophia.l@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000007'::uuid, 'mason.d@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000008'::uuid, 'isabella.w@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000009'::uuid, 'james.p@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000010'::uuid, 'mia.h@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000011'::uuid, 'ben.c@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000012'::uuid, 'charlotte.s@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000013'::uuid, 'lucas.g@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000014'::uuid, 'amelia.f@courtplay.test'),
    ('d0000000-0000-0000-0000-000000000015'::uuid, 'henry.n@courtplay.test')
) as u(id, email)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2) public.users — profiles (variety of skill levels).
-- ------------------------------------------------------------
insert into public.users (id, email, first_name, last_name, headline, photo_url, skill_level, new_to_westport)
values
    ('d0000000-0000-0000-0000-000000000001', 'olivia.r@courtplay.test', 'Olivia', 'R', 'Morning hitter at Longshore', 'https://i.pravatar.cc/150?img=1', '4.0', false),
    ('d0000000-0000-0000-0000-000000000002', 'liam.k@courtplay.test', 'Liam', 'K', 'Weekend round-robin regular', 'https://i.pravatar.cc/150?img=12', '3.5', false),
    ('d0000000-0000-0000-0000-000000000003', 'emma.t@courtplay.test', 'Emma', 'T', 'Competitive league player', 'https://i.pravatar.cc/150?img=5', '4.5', false),
    ('d0000000-0000-0000-0000-000000000004', 'noah.b@courtplay.test', 'Noah', 'B', 'Getting back into the game', 'https://i.pravatar.cc/150?img=15', '3.0', true),
    ('d0000000-0000-0000-0000-000000000005', 'ava.m@courtplay.test', 'Ava', 'M', 'Former college player', 'https://i.pravatar.cc/150?img=9', '5.0', false),
    ('d0000000-0000-0000-0000-000000000006', 'sophia.l@courtplay.test', 'Sophia', 'L', 'New to tennis, love it already', 'https://i.pravatar.cc/150?img=20', '2.5', true),
    ('d0000000-0000-0000-0000-000000000007', 'mason.d@courtplay.test', 'Mason', 'D', 'Plays most evenings', 'https://i.pravatar.cc/150?img=33', '4.0', false),
    ('d0000000-0000-0000-0000-000000000008', 'isabella.w@courtplay.test', 'Isabella', 'W', 'Doubles enthusiast', 'https://i.pravatar.cc/150?img=25', '3.5', false),
    ('d0000000-0000-0000-0000-000000000009', 'james.p@courtplay.test', 'James', 'P', 'Singles grinder', 'https://i.pravatar.cc/150?img=51', '4.5', false),
    ('d0000000-0000-0000-0000-000000000010', 'mia.h@courtplay.test', 'Mia', 'H', 'Sunset doubles fan', 'https://i.pravatar.cc/150?img=45', '3.0', false),
    ('d0000000-0000-0000-0000-000000000011', 'ben.c@courtplay.test', 'Ben', 'C', 'Early-bird singles', 'https://i.pravatar.cc/150?img=53', '5.0', false),
    ('d0000000-0000-0000-0000-000000000012', 'charlotte.s@courtplay.test', 'Charlotte', 'S', 'Taking weekly lessons', 'https://i.pravatar.cc/150?img=32', '2.5', true),
    ('d0000000-0000-0000-0000-000000000013', 'lucas.g@courtplay.test', 'Lucas', 'G', 'Round-robin organizer', 'https://i.pravatar.cc/150?img=60', '4.0', false),
    ('d0000000-0000-0000-0000-000000000014', 'amelia.f@courtplay.test', 'Amelia', 'F', 'Cardio tennis regular', 'https://i.pravatar.cc/150?img=47', '3.5', false),
    ('d0000000-0000-0000-0000-000000000015', 'henry.n@courtplay.test', 'Henry', 'N', 'Clinic + match play', 'https://i.pravatar.cc/150?img=68', '4.5', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3) public.posts — 20 posts. game_date = current_date + day_off
--    (negative = past, 0 = today, positive = upcoming). court_id is
--    resolved by name so it matches whatever the courts seed assigned.
--    play_type is mirrored into `format` so both feed-filter paths match.
-- ------------------------------------------------------------
insert into public.posts (
    id, author_id, author_type, post_type, format, play_type, duration, total_players,
    game_date, game_time, skill_level, location, court_id, cost, original_cost,
    spots_total, notes, pro_name, status, created_at
)
select
    d.id, d.author_id, 'player', d.post_type, d.play_type, d.play_type, d.duration, d.total_players,
    current_date + d.day_off, d.game_time::time, d.skill, c.name, c.id, d.cost, d.orig,
    d.spots, nullif(d.notes, ''), d.pro_name, 'active', now()
from (values
    -- id, author_id, post_type, play_type, duration, total_players, day_off, game_time, skill, court_name, cost, orig, spots, notes, pro_name
    ('e0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid, 'sub_need',     'point_play',  1.5, 4, -30, '09:00', '4.0', 'Longshore Tennis Club',       20.00, null::numeric, 1, 'Need a 4th for friendly doubles',   null::text),
    ('e0000000-0000-0000-0000-000000000002'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid, 'regular_game', 'round_robin', 2.0, 4, -21, '18:00', '3.5', 'Staples High School',         null,  null,          3, 'Weekly evening round robin',        null),
    ('e0000000-0000-0000-0000-000000000003'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid, 'sub_need',     'clinic',      1.0, 6, -14, '10:00', '4.5', 'Westport Tennis Club',        35.00, 45.00,         2, 'Spot opened in Saturday clinic',    'Coach Dave'),
    ('e0000000-0000-0000-0000-000000000004'::uuid, 'd0000000-0000-0000-0000-000000000004'::uuid, 'sub_need',     'lesson',      1.0, 2, -10, '16:30', '3.0', 'YMCA of Western CT',          40.00, null,          1, 'Share a private lesson slot',       'Coach Lena'),
    ('e0000000-0000-0000-0000-000000000005'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid, 'regular_game', 'point_play',  2.0, 2,  -7, '07:00', '5.0', 'Compo Beach Tennis',          null,  null,          1, 'Fast singles for early birds',      null),
    ('e0000000-0000-0000-0000-000000000006'::uuid, 'd0000000-0000-0000-0000-000000000006'::uuid, 'sub_need',     'point_play',  1.5, 4,  -5, '12:00', '2.5', 'Saugatuck Elementary',        15.00, null,          2, 'Beginner-friendly, come learn',     null),
    ('e0000000-0000-0000-0000-000000000007'::uuid, 'd0000000-0000-0000-0000-000000000007'::uuid, 'sub_need',     'other',       1.0, 2,  -3, '19:00', '4.0', 'Bedford Middle School',       10.00, null,          1, 'Casual hitting session',            null),
    ('e0000000-0000-0000-0000-000000000008'::uuid, 'd0000000-0000-0000-0000-000000000008'::uuid, 'regular_game', 'round_robin', 2.0, 4,  -2, '17:00', '3.5', 'Greens Farms Tennis',         null,  null,          4, '',                                  null),
    ('e0000000-0000-0000-0000-000000000009'::uuid, 'd0000000-0000-0000-0000-000000000009'::uuid, 'sub_need',     'clinic',      1.5, 6,  -1, '08:00', '4.5', 'Assumption Catholic School',  30.00, null,          2, 'One spot left in AM clinic',        'Coach Sam'),
    ('e0000000-0000-0000-0000-000000000010'::uuid, 'd0000000-0000-0000-0000-000000000010'::uuid, 'sub_need',     'point_play',  1.0, 4,   0, '18:00', '3.0', 'Sherwood Island',             18.00, 25.00,         1, 'Sunset doubles tonight',            null),
    ('e0000000-0000-0000-0000-000000000011'::uuid, 'd0000000-0000-0000-0000-000000000011'::uuid, 'regular_game', 'point_play',  1.5, 2,   0, '06:30', '5.0', 'Longshore Tennis Club',       null,  null,          1, 'Early singles before work',         null),
    ('e0000000-0000-0000-0000-000000000012'::uuid, 'd0000000-0000-0000-0000-000000000012'::uuid, 'sub_need',     'lesson',      1.0, 2,   1, '15:00', '2.5', 'Staples High School',         45.00, null,          1, 'Split a beginner lesson',           'Coach Mia'),
    ('e0000000-0000-0000-0000-000000000013'::uuid, 'd0000000-0000-0000-0000-000000000013'::uuid, 'sub_need',     'round_robin', 2.0, 4,   2, '10:00', '4.0', 'Westport Tennis Club',        25.00, null,          3, 'Sat round robin, need players',     null),
    ('e0000000-0000-0000-0000-000000000014'::uuid, 'd0000000-0000-0000-0000-000000000014'::uuid, 'regular_game', 'clinic',      1.5, 8,   3, '09:00', '3.5', 'YMCA of Western CT',          30.00, null,          4, 'Cardio tennis clinic',              'Coach Ben'),
    ('e0000000-0000-0000-0000-000000000015'::uuid, 'd0000000-0000-0000-0000-000000000015'::uuid, 'sub_need',     'point_play',  1.0, 4,   5, '17:30', '4.5', 'Compo Beach Tennis',          20.00, null,          2, 'Doubles after work',                null),
    ('e0000000-0000-0000-0000-000000000016'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid, 'sub_need',     'other',       1.0, 1,   7, '11:00', '3.0', 'Saugatuck Elementary',        12.00, null,          1, 'Ball machine practice partner',     null),
    ('e0000000-0000-0000-0000-000000000017'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid, 'regular_game', 'point_play',  2.0, 2,  10, '08:00', '4.0', 'Bedford Middle School',       null,  null,          2, '',                                  null),
    ('e0000000-0000-0000-0000-000000000018'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid, 'sub_need',     'clinic',      1.5, 6,  14, '10:00', '5.0', 'Greens Farms Tennis',         50.00, 60.00,         2, 'Advanced clinic, high level',       'Coach Dave'),
    ('e0000000-0000-0000-0000-000000000019'::uuid, 'd0000000-0000-0000-0000-000000000007'::uuid, 'sub_need',     'point_play',  1.0, 4,  21, '19:00', '3.5', 'Assumption Catholic School',  16.00, null,          1, 'Evening doubles, fun group',        null),
    ('e0000000-0000-0000-0000-000000000020'::uuid, 'd0000000-0000-0000-0000-000000000009'::uuid, 'regular_game', 'round_robin', 2.0, 4,  30, '09:30', '2.5', 'Sherwood Island',             null,  null,          4, 'Monthly social round robin',        null)
) as d(id, author_id, post_type, play_type, duration, total_players, day_off, game_time, skill, court_name, cost, orig, spots, notes, pro_name)
join public.courts c on c.name = d.court_name
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Teardown (uncomment to remove all of the above):
-- ------------------------------------------------------------
-- delete from public.posts where id >= 'e0000000-0000-0000-0000-000000000000' and id <= 'e0000000-0000-0000-0000-0000000000ff';
-- delete from public.users where id >= 'd0000000-0000-0000-0000-000000000000' and id <= 'd0000000-0000-0000-0000-0000000000ff';
-- delete from auth.users  where id >= 'd0000000-0000-0000-0000-000000000000' and id <= 'd0000000-0000-0000-0000-0000000000ff';
