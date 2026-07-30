-- ============================================================
-- Stop the anon key from reading every user's email.
--
-- The policy this replaces was:
--
--   create policy "Public users readable" on public.users
--     for select using (deleted_at is null and is_suspended = false);
--
-- No auth.uid() predicate, so `anon` qualified. Confirmed 2026-07-29: the
-- publishable key that ships in the JS bundle returned all 27 rows including
-- every email address, plus phone and venmo_handle values. The same policy also
-- meant any signed-in user could read every other user's contact details, so
-- restricting this to authenticated callers would only have been half a fix.
--
-- Direct table reads are now own-row only. Everything cross-user already goes
-- through security-definer RPCs (get_feed, get_profile, get_post_by_id,
-- search_users, get_my_posts_with_claims, …) which bypass RLS and are unaffected;
-- each of those hand-picks the columns it returns and none of them return email,
-- phone or venmo_handle.
--
-- Written idempotently so it's safe to re-run in the SQL editor.
-- ============================================================

-- ── Recursion-safe admin check ──────────────────────────────────────────────
-- The admin policy needs to ask "is the caller an admin", which means reading
-- public.users from inside a policy on public.users. That is the classic RLS
-- recursion trap: it only worked before because the wide-open SELECT policy
-- satisfied the inner read. With own-row-only it would be evaluating a policy in
-- order to evaluate the same policy, so the lookup moves into a security-definer
-- function that is not subject to RLS at all.
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false);
$$;

-- anon gets execute too: the policies below are evaluated for anonymous requests
-- as well, and a missing EXECUTE grant would surface as a permission error
-- rather than a clean "no rows". For anon, auth.uid() is null, so it returns false.
revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to anon, authenticated;

-- ── SELECT: own row, or admin ───────────────────────────────────────────────
drop policy if exists "Public users readable" on public.users;

drop policy if exists "Users read own row" on public.users;
create policy "Users read own row" on public.users
    for select using (auth.uid() = id);

-- Replaces the previous "Admins full access users", which used an inline
-- subquery against public.users. Same intent, no recursion.
drop policy if exists "Admins full access users" on public.users;
drop policy if exists "Admins full access users v2" on public.users;
create policy "Admins full access users v2" on public.users
    for all using (public.is_admin_user());

-- ── Replace the two direct cross-user reads in onboarding ───────────────────
-- The invite step searched public.users directly by name and listed the most
-- recently joined players. Both only ever needed public-facing fields, but they
-- needed other users' rows to get them, so they move behind security definer.

-- search_users already existed and is security definer; it just didn't return
-- headline, which the onboarding cards display. Additive change only.
create or replace function public.search_users(p_query text, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    result jsonb;
    v_uid uuid := auth.uid();
    v_query text := '%' || lower(p_query) || '%';
begin
    if v_uid is null then
        raise exception 'Not authenticated';
    end if;

    select coalesce(json_agg(row_data), '[]')
    into result
    from (
        select jsonb_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'photo_url', u.photo_url,
            'skill_level', u.skill_level,
            'headline', u.headline,
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

revoke all on function public.search_users(text, integer) from public, anon;
grant execute on function public.search_users(text, integer) to authenticated;

-- The most recently joined players, for the onboarding invite step. Same shape
-- as search_users so the client can use one result type for both.
create or replace function public.get_suggested_follows(p_limit integer default 5)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    result jsonb;
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Not authenticated';
    end if;

    select coalesce(json_agg(row_data), '[]')
    into result
    from (
        select jsonb_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'photo_url', u.photo_url,
            'skill_level', u.skill_level,
            'headline', u.headline,
            'new_to_westport', u.new_to_westport,
            'is_following', exists(
                select 1 from public.follows f
                where f.follower_id = v_uid and f.following_id = u.id
            )
        ) as row_data
        from public.users u
        where u.deleted_at is null
          and u.is_suspended = false
          and u.id != v_uid
        order by u.created_at desc
        limit p_limit
    ) sub;

    return result;
end;
$$;

-- Lock to authenticated: Supabase default-grants anon directly, so revoke that too.
revoke all on function public.get_suggested_follows(integer) from public, anon;
grant execute on function public.get_suggested_follows(integer) to authenticated;
