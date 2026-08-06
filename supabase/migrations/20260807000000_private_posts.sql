-- ============================================================
-- Private posts: a post only a chosen audience can see and claim.
--
-- The audience is deliberately NOT a list of people. It is two things the
-- poster already maintains:
--
--   * audience_all_following — everyone the POSTER FOLLOWS, evaluated live
--   * post_audience_groups   — the members of the groups they picked
--
-- Both are dynamic: follow someone tomorrow, or add them to a group, and they
-- can see the post. That matches how the picker reads ("All players followed",
-- not a frozen list of names) and means there is no membership snapshot to go
-- stale.
--
-- THE DIRECTION OF `follows` IS THE BUG TO WATCH FOR. "All players followed"
-- means players the AUTHOR follows, so the viewer must sit on the author's
-- FOLLOWING list: follower_id = author, following_id = viewer. Reversed, the
-- post silently goes to the author's followers instead — a different group of
-- people, and the mistake looks completely plausible in review. The same trap
-- exists again in the notification resolver.
--
-- visibility defaults to 'public', which is what makes this safe to apply to a
-- live table: every post already out there stays exactly as visible as it was.
-- ============================================================

alter table public.posts
    add column if not exists visibility text not null default 'public'
        check (visibility in ('public', 'private')),
    add column if not exists audience_all_following boolean not null default false;

create table if not exists public.post_audience_groups (
    post_id    uuid not null references public.posts(id)  on delete cascade,
    group_id   uuid not null references public.groups(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_id, group_id)
);

-- The membership lookup runs group-first when resolving notification
-- recipients, post-first when checking visibility. Index both directions.
create index if not exists post_audience_groups_group_id_idx
    on public.post_audience_groups (group_id);

alter table public.post_audience_groups enable row level security;

-- ------------------------------------------------------------
-- The one predicate. Every read path calls this and none reimplements it —
-- duplicating the logic is precisely how one of them ends up wrong.
--
-- security definer is load-bearing twice over: it lets the function read posts
-- from inside a posts RLS policy without recursing (the trap documented in
-- 20260729000000_restrict_users_select.sql), and it lets it see group_members
-- rows the caller cannot select directly.
-- ------------------------------------------------------------
create or replace function public.can_see_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.posts p
        where p.id = p_post_id
          and (
              p.visibility = 'public'
              -- The author always sees their own, including before an audience
              -- is attached. Without this a private post is invisible to the
              -- person who just wrote it.
              or p.author_id = auth.uid()
              or public.is_admin_user()
              or (
                  auth.uid() is not null
                  and (
                      -- Anyone already attached to the post keeps seeing it.
                      -- A claim can only exist if they could see the post when
                      -- they made it, so this widens nothing — it repairs the
                      -- case where the audience changes underneath them: the
                      -- author edits the groups, or the claimer leaves one.
                      -- Without it, an approved claimer can lose the page for
                      -- a game they are booked into.
                      exists(
                          select 1 from public.claims c
                          where c.post_id = p.id
                            and c.claimer_id = auth.uid()
                            and c.status in ('pending', 'approved')
                      )
                      or
                      (
                          p.audience_all_following
                          and exists(
                              select 1 from public.follows f
                              where f.follower_id = p.author_id     -- author follows…
                                and f.following_id = auth.uid()     -- …the viewer
                          )
                      )
                      -- A CLOSED group still grants access. The audience was
                      -- settled when the post went up, and closing a group
                      -- afterwards should not yank a live post away from
                      -- someone who may already have claimed it. Deleting the
                      -- group is the stronger signal and does revoke.
                      or exists(
                          select 1
                          from public.post_audience_groups pag
                          join public.groups g on g.id = pag.group_id
                          join public.group_members gm on gm.group_id = pag.group_id
                          where pag.post_id = p.id
                            and gm.user_id = auth.uid()
                            and gm.removed_at is null
                            and g.deleted_at is null
                      )
                  )
              )
          )
    );
$$;

-- ------------------------------------------------------------
-- Writing the audience.
--
-- The composer inserts the post directly (post-new.tsx) rather than through an
-- RPC, so the audience is a second call. That split fails CLOSED: a private
-- post whose audience write never lands is visible to its author alone, never
-- to everyone. The reverse ordering would have the opposite failure mode.
-- ------------------------------------------------------------
create or replace function public.set_post_audience(p_post_id uuid, p_group_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_post record;
begin
    select * into v_post from public.posts
    where id = p_post_id and deleted_at is null;

    if not found or v_post.author_id <> auth.uid() then
        return jsonb_build_object('success', false, 'error', 'Post not found');
    end if;

    -- Replace wholesale rather than diffing: the caller always sends the full
    -- set, and a partial update is how an unpicked group survives an edit.
    delete from public.post_audience_groups where post_id = p_post_id;

    if array_length(p_group_ids, 1) is not null then
        insert into public.post_audience_groups (post_id, group_id)
        select p_post_id, g.id
        from public.groups g
        where g.id = any(p_group_ids)
          and g.deleted_at is null
          -- You can only address a post to a group you are actually in;
          -- otherwise the picker's contents become a trust boundary.
          and public.is_group_member(g.id, auth.uid());
    end if;

    -- Watchers who can no longer see the post must stop hearing about it.
    -- notify_me rows written while the post was public would otherwise keep
    -- firing price_drop / spot_reopened at people now outside the audience —
    -- a leak that only appears on a public -> private edit, which is exactly
    -- the case nobody thinks to test.
    delete from public.notify_me nm
    where nm.post_id = p_post_id
      and not exists (
          select 1 from public.posts p where p.id = p_post_id and p.visibility = 'public'
      )
      and nm.user_id <> v_post.author_id
      and not (
          (v_post.audience_all_following and exists(
              select 1 from public.follows f
              where f.follower_id = v_post.author_id
                and f.following_id = nm.user_id
          ))
          or exists(
              select 1
              from public.post_audience_groups pag
              join public.group_members gm on gm.group_id = pag.group_id
              where pag.post_id = p_post_id
                and gm.user_id = nm.user_id
                and gm.removed_at is null
          )
      );

    return jsonb_build_object('success', true);
end;
$$;

-- Edit mode needs the saved audience to build its dirty-tracking baseline.
create or replace function public.get_post_audience(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'group_ids', coalesce(
            (select jsonb_agg(pag.group_id)
             from public.post_audience_groups pag
             join public.posts p on p.id = pag.post_id
             where pag.post_id = p_post_id
               and p.author_id = auth.uid()),
            '[]'::jsonb
        )
    );
$$;

-- ------------------------------------------------------------
-- RLS.
--
-- The existing SELECT policy is MODIFIED rather than joined by a second one:
-- policies are OR-ed, so leaving the old permissive rule in place would defeat
-- the entire feature. "Users read own posts" (20260719000000) and the admin
-- policy stay as they are — both are meant to be broader.
-- ------------------------------------------------------------
drop policy if exists "Signed-in users read posts" on public.posts;
create policy "Signed-in users read posts" on public.posts
  for select using (
    auth.role() = 'authenticated'
    and status = 'active'
    and public.can_see_post(id)
  );

drop policy if exists "Authors read their post audience" on public.post_audience_groups;
create policy "Authors read their post audience" on public.post_audience_groups
  for select using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

drop policy if exists "Admins read all post audiences" on public.post_audience_groups;
create policy "Admins read all post audiences" on public.post_audience_groups
  for select using (public.is_admin_user());

-- Grants. Supabase default-grants to anon directly, so revoking from public
-- alone leaves anon able to call these — revoke from both. No write grants on
-- the table: the invariants live in set_post_audience.
revoke all on public.post_audience_groups from anon;
grant select on public.post_audience_groups to authenticated;

revoke all on function public.set_post_audience(uuid, uuid[]) from public, anon;
revoke all on function public.get_post_audience(uuid) from public, anon;
grant execute on function public.set_post_audience(uuid, uuid[]) to authenticated;
grant execute on function public.get_post_audience(uuid) to authenticated;

-- can_see_post is the exception, and deliberately so. Functions inside an RLS
-- policy run with the CALLER's privileges, so an anonymous `select from posts`
-- evaluates this one — and without EXECUTE that query raises "permission
-- denied for function" instead of returning zero rows. is_admin_user is
-- anon-callable for exactly this reason. Nothing leaks: with auth.uid() null
-- it can only ever answer true for a post whose visibility is already public.
revoke all on function public.can_see_post(uuid) from public;
grant execute on function public.can_see_post(uuid) to authenticated, anon;
