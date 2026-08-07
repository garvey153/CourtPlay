-- ============================================================
-- Tag the group you're playing with.
--
-- A post now names two different kinds of people, and the whole design turns on
-- them being different:
--
--   the AUDIENCE      — who might fill the spot   (post_audience_groups)
--   the TAGGED group  — who is already playing    (posts.tagged_group_id)
--
-- They are disjoint by construction. That is why the same group can never be
-- both, enforced below, and why a tagged member can SEE the post but is never
-- offered the claim: they are in the game already, not candidates for the spot.
--
-- Tagging grants read access. Every tagged member gets three notifications
-- (posted, claimed, approved), and a notification that dead-ends on "no longer
-- available" is broken. It grants nothing else.
-- ============================================================

alter table public.posts
    -- set null, never cascade: deleting a group must not delete the posts that
    -- merely mentioned it.
    add column if not exists tagged_group_id uuid references public.groups(id) on delete set null;

create index if not exists posts_tagged_group_id_idx
    on public.posts (tagged_group_id) where tagged_group_id is not null;

-- ------------------------------------------------------------
-- One clause added to the single visibility predicate. Everything already
-- routed through can_see_post — get_feed, get_post_by_id, get_profile,
-- submit_claim, add_notify_me, the posts SELECT policy — picks this up for
-- free. There must not be a second visibility path for tagging.
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
                      -- NEW: the group being played with. Read access only —
                      -- submit_claim refuses them separately.
                      or exists(
                          select 1
                          from public.group_members gm
                          join public.groups g on g.id = gm.group_id
                          where gm.group_id = p.tagged_group_id
                            and gm.user_id = auth.uid()
                            and gm.removed_at is null
                            and g.deleted_at is null
                      )
                  )
              )
          )
    );
$$;

revoke all on function public.can_see_post(uuid) from public;
grant execute on function public.can_see_post(uuid) to authenticated, anon;

-- ------------------------------------------------------------
-- One writer for both fields.
--
-- The tag and the audience have to be checked AGAINST EACH OTHER, so they
-- cannot be written independently — two RPCs racing each other could leave the
-- same group in both roles. Hence the third parameter rather than a separate
-- set_post_tag.
--
-- The parameter is defaulted, so the two-argument call the currently deployed
-- frontend makes still resolves during the deploy window.
--
-- NOTE this function REPLACES a post's sharing rather than patching it, in both
-- fields. Omitting p_tagged_group_id therefore CLEARS the tag — verified, not
-- assumed. That is harmless during the deploy window (no post carries a tag
-- until the new frontend ships) but it means every caller must send all three
-- arguments, always. There is no "leave the tag alone" call.
-- ------------------------------------------------------------
drop function if exists public.set_post_audience(uuid, uuid[]);

create or replace function public.set_post_audience(
    p_post_id uuid,
    p_group_ids uuid[] default '{}',
    p_tagged_group_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_post record;
    v_tagged uuid := p_tagged_group_id;
begin
    select * into v_post from public.posts
    where id = p_post_id and deleted_at is null;

    if not found or v_post.author_id <> auth.uid() then
        return jsonb_build_object('success', false, 'error', 'Post not found');
    end if;

    -- The people you're playing with are not the people who might fill the
    -- spot. The form prevents this, but the form is not the boundary.
    if v_tagged is not null and v_tagged = any(coalesce(p_group_ids, '{}')) then
        return jsonb_build_object(
            'success', false,
            'error', 'A group can''t be both the audience and the group you''re playing with'
        );
    end if;

    -- You can only tag a group you're in, for the same reason you can only
    -- address a post to one: otherwise the picker's contents become a trust
    -- boundary. An unusable id is dropped rather than rejected — it can only
    -- come from a stale client.
    if v_tagged is not null and not public.is_group_member(v_tagged, auth.uid()) then
        v_tagged := null;
    end if;

    update public.posts set tagged_group_id = v_tagged where id = p_post_id;

    -- Replace wholesale rather than diffing: the caller always sends the full
    -- set, and a partial update is how an unpicked group survives an edit.
    delete from public.post_audience_groups where post_id = p_post_id;

    if array_length(p_group_ids, 1) is not null then
        insert into public.post_audience_groups (post_id, group_id)
        select p_post_id, g.id
        from public.groups g
        where g.id = any(p_group_ids)
          and g.deleted_at is null
          and public.is_group_member(g.id, auth.uid());
    end if;

    -- Watchers who can no longer see the post must stop hearing about it.
    -- notify_me rows written while the post was public would otherwise keep
    -- firing price_drop / spot_reopened at people now outside the audience —
    -- a leak that only appears on a public -> private edit, which is exactly
    -- the case nobody thinks to test. Tagged members are spared: they can
    -- still see the post.
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
          or exists(
              select 1 from public.group_members gm
              where gm.group_id = v_tagged
                and gm.user_id = nm.user_id
                and gm.removed_at is null
          )
      );

    return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.set_post_audience(uuid, uuid[], uuid) from public, anon;
grant execute on function public.set_post_audience(uuid, uuid[], uuid) to authenticated;

-- Edit mode needs both saved values to build its dirty-tracking baseline.
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
        ),
        'tagged_group_id', (
            select p.tagged_group_id from public.posts p
            where p.id = p_post_id and p.author_id = auth.uid()
        )
    );
$$;

revoke all on function public.get_post_audience(uuid) from public, anon;
grant execute on function public.get_post_audience(uuid) to authenticated;

-- ------------------------------------------------------------
-- The opposite of visibility: a tagged member can see the post but must not
-- claim it. Unlike the Phase 4 refusals this message can be honest — they can
-- see the post, so there is nothing left to conceal.
-- ------------------------------------------------------------
create or replace function public.submit_claim(p_post_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_post record;
    v_conflict_date date;
    v_conflict_time time;
    v_claim_id uuid;
    v_spots_available integer;
    v_existing_claim_id uuid;
    v_is_regular boolean;
begin
    select * into v_post from public.posts
    where id = p_post_id and status = 'active' and deleted_at is null;

    -- Deliberately the SAME branch and message as "no such post". Splitting
    -- them out into a "this post is private" error would tell anyone holding an
    -- id that the post exists and who wrote it.
    if not found or not public.can_see_post(p_post_id) then
        return jsonb_build_object('success', false, 'error', 'Post not found or no longer active');
    end if;

    -- Tagged = already playing. The sheet offers them no claim button; this is
    -- the same rule at the boundary.
    if v_post.tagged_group_id is not null
       and public.is_group_member(v_post.tagged_group_id, auth.uid()) then
        return jsonb_build_object('success', false, 'error', 'You''re already playing in this game');
    end if;

    v_is_regular := (v_post.post_type = 'regular_game');

    -- One connection/claim per responder per post.
    select id into v_existing_claim_id
    from public.claims
    where post_id = p_post_id and claimer_id = auth.uid() and status in ('pending', 'approved')
    limit 1;
    if found then
        return jsonb_build_object('success', false, 'error', 'You already have an active claim on this post');
    end if;

    -- Regular posts don't consume spots (many responders reach out to one seeker),
    -- so the spots/full check applies to sub_need posts only.
    if not v_is_regular then
        v_spots_available := greatest(0, v_post.spots_total - coalesce(
            (select count(*)::integer from public.claims c
             where c.post_id = p_post_id and c.status in ('pending', 'approved')), 0));
        if v_spots_available <= 0 then
            return jsonb_build_object('success', false, 'error', 'No spots available');
        end if;

        -- Time conflict: same user already booked at this exact date+time (dated subs only).
        select p2.game_date, p2.game_time into v_conflict_date, v_conflict_time
        from public.claims c
        join public.posts p2 on p2.id = c.post_id
        where c.claimer_id = auth.uid() and c.status in ('pending', 'approved')
          and p2.game_date = v_post.game_date and p2.game_time = v_post.game_time
          and c.post_id != p_post_id
        limit 1;
        if found then
            return jsonb_build_object('success', false, 'conflict', true,
                'conflict_date', v_conflict_date, 'conflict_time', v_conflict_time);
        end if;
    end if;

    insert into public.claims (post_id, claimer_id, status)
    values (p_post_id, auth.uid(), 'pending')
    returning id into v_claim_id;

    -- Store the responder's opening message, if any.
    if p_message is not null and length(trim(p_message)) > 0 then
        insert into public.claim_messages (claim_id, sender_id, body)
        values (v_claim_id, auth.uid(), trim(p_message));
    end if;

    return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$$;

revoke all on function public.submit_claim(uuid, text) from public, anon;
grant execute on function public.submit_claim(uuid, text) to authenticated;
