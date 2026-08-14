-- When the feed may ask for push permission.
--
-- Three conditions, all required:
--
--   1. 14 days since signup. Asking a brand-new account for a system permission
--      before it has seen the app work is how a permanent "denied" gets set,
--      and a denial cannot be undone from the page.
--   2. At least one action taken: a post, a claim, a group membership, or a
--      follow in either direction. Someone who has done nothing has nothing to
--      be notified about.
--   3. They did not opt into push during onboarding. That step already asked;
--      asking again in the feed is asking twice.
--
-- Server-side rather than assembled in the feed, because the client holds only
-- some of these: it has posts and claims, but no follow counts, and reading the
-- onboarding answer means reading notification_preferences either way. One
-- predicate, one place to change the rule.
--
-- Note this deliberately says nothing about browser permission state or whether
-- the banner was dismissed. Those are the device's business and stay on the
-- client.

create or replace function public.push_prompt_eligible()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select
        exists(
            select 1 from public.users u
            where u.id = auth.uid()
              and u.created_at <= now() - interval '14 days'
        )
        and (
            exists(select 1 from public.posts p where p.author_id = auth.uid() and p.deleted_at is null)
            or exists(select 1 from public.claims c where c.claimer_id = auth.uid())
            or exists(
                select 1 from public.group_members gm
                where gm.user_id = auth.uid() and gm.removed_at is null
            )
            or exists(
                select 1 from public.follows f
                where f.follower_id = auth.uid() or f.following_id = auth.uid()
            )
        )
        and not exists(
            select 1 from public.notification_preferences np
            where np.user_id = auth.uid() and np.push_enabled
        );
$$;

revoke all on function public.push_prompt_eligible() from public, anon;
grant execute on function public.push_prompt_eligible() to authenticated;
