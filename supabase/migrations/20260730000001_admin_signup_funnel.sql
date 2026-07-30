-- ============================================================
-- Make the admin funnel's first two steps measurable.
--
-- The "Profile complete" step queried a `full_name` column that has never
-- existed — `last_name_initial` was renamed to `last_name` in 20260404000001 and
-- nothing ever added `full_name`. PostgREST answered 400, `count` came back
-- undefined, and `?? 0` turned it into a clean-looking zero. The admin funnel has
-- always shown "Profile complete: 0".
--
-- Renaming the column in the query would not have fixed the metric. There is no
-- trigger creating public.users from auth.users — the app writes that row in
-- onboarding's final upsert, after step 1 has already required first name, last
-- name and skill level. So every public.users row is by definition a completed
-- profile, and counting a non-null column there would just reproduce the signup
-- count and imply 100% completion.
--
-- The two populations only differ in auth.users, which the anon/authenticated
-- roles cannot read. Hence this function: it is the only way to see drop-off
-- between "created an account" and "finished onboarding", which is the entire
-- point of that funnel step.
-- ============================================================

create or replace function public.admin_get_signup_funnel()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_signups  integer;
    v_profiles integer;
begin
    -- Reuse the helper from 20260729000000 rather than an inline subquery, which
    -- would be a second place to keep the admin definition in step.
    if not public.is_admin_user() then
        raise exception 'Admin only';
    end if;

    -- Deliberately no filtering here: auth.users column availability varies
    -- between Supabase versions, and a raw count is the number this funnel wants
    -- anyway — everyone who ever created an account.
    select count(*) into v_signups from auth.users;

    select count(*) into v_profiles
    from public.users
    where deleted_at is null;

    return jsonb_build_object(
        'signups',  v_signups,
        'profiles', v_profiles
    );
end;
$$;

-- Lock to authenticated: Supabase default-grants anon directly, so revoke that
-- too. The is_admin_user() check above is what actually gates it.
revoke all on function public.admin_get_signup_funnel() from public, anon;
grant execute on function public.admin_get_signup_funnel() to authenticated;
