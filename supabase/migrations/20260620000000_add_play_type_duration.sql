-- Add play_type + duration to posts and surface them in the feed RPCs.
-- play_type drives the feed card title ("{play type} Tennis"); duration shows
-- in the card/sheet subtitle ("… · 2 hrs").

alter table public.posts
    add column if not exists play_type text,
    add column if not exists duration numeric;

-- play_type supersedes the old `format` field. Backfill existing rows so prior
-- posts still show a type in the card title. (format column is kept but no
-- longer written by the create form.)
update public.posts set play_type = format where play_type is null and format is not null;

-- get_feed returns a TABLE, so the changed signature requires a drop + recreate.
drop function if exists get_feed();
create function get_feed()
returns table (
    id uuid,
    author_id uuid,
    author_type text,
    post_type text,
    format text,
    play_type text,
    duration numeric,
    total_players integer,
    game_date date,
    game_time time,
    skill_level text,
    location text,
    court_id uuid,
    custom_court text,
    pro_name text,
    cost numeric,
    original_cost numeric,
    spots_total integer,
    series_id uuid,
    notes text,
    status text,
    view_count integer,
    expires_at timestamptz,
    preferred_days text[],
    preferred_times text[],
    created_at timestamptz,
    first_name text,
    last_name text,
    photo_url text,
    is_friend boolean,
    spots_available integer
)
language sql
security definer
stable
as $$
    with feed_data as (
        select
            p.id,
            p.author_id,
            p.author_type,
            p.post_type,
            p.format,
            p.play_type,
            p.duration,
            p.total_players,
            p.game_date,
            p.game_time,
            p.skill_level,
            p.location,
            p.court_id,
            p.custom_court,
            p.pro_name,
            p.cost,
            p.original_cost,
            p.spots_total,
            p.series_id,
            p.notes,
            p.status,
            p.view_count,
            p.expires_at,
            p.preferred_days,
            p.preferred_times,
            p.created_at,
            u.first_name,
            u.last_name,
            u.photo_url,
            exists(
                select 1 from public.follows f
                where f.follower_id = auth.uid()
                  and f.following_id = p.author_id
            ) as is_friend,
            greatest(0,
                p.spots_total - coalesce(
                    (select count(*)::integer
                     from public.claims c
                     where c.post_id = p.id
                       and c.status in ('pending', 'approved')),
                    0
                )
            ) as spots_available
        from public.posts p
        join public.users u on u.id = p.author_id
        where p.status = 'active'
          and p.deleted_at is null
          and (p.expires_at is null or p.expires_at > now())
    )
    select * from feed_data
    order by
        game_date asc nulls last,
        is_friend desc,
        created_at desc
$$;

grant execute on function get_feed() to authenticated, anon;

-- get_post_by_id returns jsonb (unchanged return type) — add the two keys.
create or replace function get_post_by_id(p_post_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    result jsonb;
    v_uid uuid;
begin
    v_uid := auth.uid(); -- may be null for anonymous

    select jsonb_build_object(
        'id', p.id,
        'author_id', p.author_id,
        'author_type', p.author_type,
        'post_type', p.post_type,
        'format', p.format,
        'play_type', p.play_type,
        'duration', p.duration,
        'total_players', p.total_players,
        'game_date', p.game_date,
        'game_time', p.game_time,
        'skill_level', p.skill_level,
        'location', p.location,
        'court_id', p.court_id,
        'custom_court', p.custom_court,
        'pro_name', p.pro_name,
        'cost', p.cost,
        'original_cost', p.original_cost,
        'spots_total', p.spots_total,
        'series_id', p.series_id,
        'notes', p.notes,
        'status', p.status,
        'view_count', p.view_count,
        'expires_at', p.expires_at,
        'preferred_days', p.preferred_days,
        'preferred_times', p.preferred_times,
        'created_at', p.created_at,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'photo_url', u.photo_url,
        'is_friend', case when v_uid is not null then exists(
            select 1 from public.follows f
            where f.follower_id = v_uid and f.following_id = p.author_id
        ) else false end,
        'spots_available', greatest(0,
            p.spots_total - coalesce(
                (select count(*)::integer from public.claims c
                 where c.post_id = p.id and c.status in ('pending', 'approved')),
                0
            )
        ),
        'user_claim_status', case when v_uid is not null then (
            select c.status from public.claims c
            where c.post_id = p.id and c.claimer_id = v_uid
            order by c.created_at desc limit 1
        ) else null end,
        'user_claim_id', case when v_uid is not null then (
            select c.id from public.claims c
            where c.post_id = p.id and c.claimer_id = v_uid
            order by c.created_at desc limit 1
        ) else null end,
        'user_notify_me', case when v_uid is not null then exists(
            select 1 from public.notify_me nm
            where nm.post_id = p.id and nm.user_id = v_uid
        ) else false end
    ) into result
    from public.posts p
    join public.users u on u.id = p.author_id
    where p.id = p_post_id
      and p.deleted_at is null;

    return result;
end;
$$;
