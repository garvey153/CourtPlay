-- ============================================================
-- Phase 6 — Profile page + follow/unfollow RPCs
-- ============================================================

-- Get a user's public profile with follow state and counts
create or replace function get_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    result jsonb;
    v_uid uuid := auth.uid();
begin
    select jsonb_build_object(
        'id', u.id,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'headline', u.headline,
        'photo_url', u.photo_url,
        'skill_level', u.skill_level,
        'court_preferences', u.court_preferences,
        'new_to_westport', u.new_to_westport,
        'follower_count', (select count(*)::integer from public.follows f where f.following_id = u.id),
        'following_count', (select count(*)::integer from public.follows f where f.follower_id = u.id),
        'is_following', case when v_uid is not null then exists(
            select 1 from public.follows f where f.follower_id = v_uid and f.following_id = u.id
        ) else false end,
        'is_own_profile', (v_uid = u.id),
        'active_posts', coalesce(
            (select json_agg(jsonb_build_object(
                'id', p.id,
                'post_type', p.post_type,
                'format', p.format,
                'game_date', p.game_date,
                'game_time', p.game_time,
                'skill_level', p.skill_level,
                'location', p.location,
                'custom_court', p.custom_court,
                'cost', p.cost,
                'spots_total', p.spots_total,
                'spots_available', greatest(0,
                    p.spots_total - coalesce(
                        (select count(*)::integer from public.claims c
                         where c.post_id = p.id and c.status in ('pending', 'approved')),
                        0
                    )
                ),
                'created_at', p.created_at
            ) order by p.created_at desc)
            from public.posts p
            where p.author_id = u.id
              and p.status = 'active'
              and p.deleted_at is null),
            '[]'
        ),
        'following_list', coalesce(
            (select json_agg(jsonb_build_object(
                'id', fu.id,
                'first_name', fu.first_name,
                'last_name', fu.last_name,
                'photo_url', fu.photo_url,
                'skill_level', fu.skill_level
            ) order by fu.first_name)
            from public.follows f2
            join public.users fu on fu.id = f2.following_id
            where f2.follower_id = u.id
              and fu.deleted_at is null
              and fu.is_suspended = false),
            '[]'
        )
    ) into result
    from public.users u
    where u.id = p_user_id
      and u.deleted_at is null
      and u.is_suspended = false;

    return result;
end;
$$;

-- Search users for follow typeahead
create or replace function search_users(p_query text, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    result jsonb;
    v_uid uuid := auth.uid();
    v_query text := '%' || lower(p_query) || '%';
begin
    select coalesce(json_agg(row_data), '[]')
    into result
    from (
        select jsonb_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'photo_url', u.photo_url,
            'skill_level', u.skill_level,
            'new_to_westport', u.new_to_westport,
            'is_following', exists(
                select 1 from public.follows f
                where f.follower_id = v_uid and f.following_id = u.id
            )
        ) as row_data
        from public.users u
        where (lower(u.first_name) like v_query or lower(u.last_name) like v_query)
          and u.deleted_at is null
          and u.is_suspended = false
          and u.id != v_uid
        order by u.first_name
        limit p_limit
    ) sub;

    return result;
end;
$$;

-- Follow a user
create or replace function follow_user(p_following_id uuid)
returns jsonb
language plpgsql
security definer
as $$
begin
    insert into public.follows (follower_id, following_id)
    values (auth.uid(), p_following_id)
    on conflict (follower_id, following_id) do nothing;

    return jsonb_build_object('success', true);
end;
$$;

-- Unfollow a user
create or replace function unfollow_user(p_following_id uuid)
returns jsonb
language plpgsql
security definer
as $$
begin
    delete from public.follows
    where follower_id = auth.uid()
      and following_id = p_following_id;

    return jsonb_build_object('success', true);
end;
$$;

-- Suggested follows for onboarding — mutual connections + shared court preferences
create or replace function get_suggested_follows()
returns jsonb
language plpgsql
security definer
stable
as $$
declare
    result jsonb;
    v_uid uuid := auth.uid();
begin
    select coalesce(json_agg(row_data), '[]')
    into result
    from (
        select distinct jsonb_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'photo_url', u.photo_url,
            'skill_level', u.skill_level,
            'new_to_westport', u.new_to_westport
        ) as row_data
        from public.users u
        where u.id != v_uid
          and u.deleted_at is null
          and u.is_suspended = false
          and u.id not in (select following_id from public.follows where follower_id = v_uid)
          and (
            -- Mutual follows: people followed by people I follow
            u.id in (
                select f2.following_id
                from public.follows f1
                join public.follows f2 on f2.follower_id = f1.following_id
                where f1.follower_id = v_uid
                  and f2.following_id != v_uid
            )
            or
            -- Shared court preferences
            u.court_preferences && (select court_preferences from public.users where id = v_uid)
          )
        limit 10
    ) sub;

    return result;
end;
$$;
