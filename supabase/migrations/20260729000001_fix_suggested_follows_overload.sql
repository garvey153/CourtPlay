-- ============================================================
-- Fix an overload collision introduced by 20260729000000.
--
-- That migration added `get_suggested_follows(p_limit integer default 5)`
-- without noticing that `get_suggested_follows()` already existed, from
-- 20260404000006_profile_rpcs. Two candidates both match a no-argument call —
-- the zero-arg one exactly, the other via its default — so PostgREST returns
--
--   PGRST203  Could not choose the best candidate function
--
-- for `rpc("get_suggested_follows")`. The onboarding call passes p_limit and so
-- resolves fine, but `src/__tests__/suggested-follows.test.tsx` documents a
-- no-argument contract and any caller using it would break.
--
-- The two functions also don't mean the same thing, which is the real reason not
-- to merge them. The original returns *suggestions*: people reachable through a
-- mutual follow or sharing a court preference, capped at 10. Onboarding's invite
-- step wants the most recently joined players — an unconditional list that is
-- never empty for a brand-new account with no follows and no court preferences.
-- Folding one into the other would have quietly emptied that step.
--
-- So the added overload is dropped and the onboarding list gets its own name.
-- ============================================================

drop function if exists public.get_suggested_follows(integer);

-- The most recently joined players. Named for what it returns, so it can't
-- collide with get_suggested_follows() again.
create or replace function public.get_recent_players(p_limit integer default 5)
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
revoke all on function public.get_recent_players(integer) from public, anon;
grant execute on function public.get_recent_players(integer) to authenticated;
