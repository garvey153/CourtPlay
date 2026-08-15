-- Deleting a deactivated player from the system, for real.
--
-- Deactivation (users.is_suspended) is the reversible action. This is the other
-- one: the profile, the login, and everything that is theirs, gone.
--
-- EVERY foreign key into public.users is NO ACTION — all nineteen of them — so a
-- plain `delete from public.users` fails for anyone who has ever posted, claimed,
-- followed, or even opened a post. Fourteen of those columns are NOT NULL, so
-- their rows must be deleted rather than detached; the other five are attribution
-- that is nulled instead, keeping the record and dropping the name.
--
-- The rule this encodes: a delete may destroy the player's own data, and may not
-- destroy anyone else's. Where it would, it refuses and says what to fix. Nothing
-- that belongs to other players disappears behind a single confirm button.

-- What a delete would take with it, and anything that blocks it.
--
-- Split from the delete itself so the confirm screen shows the blast radius
-- BEFORE the admin commits, rather than reporting it afterwards.
create or replace function public.admin_user_delete_preview(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_target   public.users;
    v_blockers jsonb := '[]'::jsonb;
    v_groups   jsonb;
begin
    if not public.is_admin_user() then
        return jsonb_build_object('error', 'Admins only');
    end if;

    select * into v_target from public.users where id = p_user_id;
    if not found then
        return jsonb_build_object('error', 'No such user');
    end if;

    -- Deactivate first. It is the reversible step, and making it a prerequisite
    -- means nobody is deleted straight from a working account by a misclick.
    if not v_target.is_suspended then
        v_blockers := v_blockers || jsonb_build_object(
            'kind', 'not_deactivated',
            'message', 'Deactivate this player first.');
    end if;

    if v_target.is_admin then
        v_blockers := v_blockers || jsonb_build_object(
            'kind', 'is_admin',
            'message', 'Remove their admin access first.');
    end if;

    if v_target.id = auth.uid() then
        v_blockers := v_blockers || jsonb_build_object(
            'kind', 'self',
            'message', 'You cannot delete your own account here.');
    end if;

    -- The one case where deleting their data would delete other people's: a group
    -- they created that other players are still in. Deleting it would remove a
    -- group from everyone in it, so it is handed back to the admin to reassign.
    -- A group where they are the only member is theirs alone and goes with them.
    select jsonb_agg(jsonb_build_object('name', g.name, 'members', m.cnt))
    into v_groups
    from public.groups g
    join lateral (
        select count(*) as cnt
        from public.group_members gm
        where gm.group_id = g.id and gm.user_id <> p_user_id
    ) m on true
    where g.created_by = p_user_id and m.cnt > 0;

    if v_groups is not null then
        v_blockers := v_blockers || jsonb_build_object(
            'kind', 'owns_groups',
            'message', 'They created a group other players are in. Reassign or delete it first.',
            'groups', v_groups);
    end if;

    return jsonb_build_object(
        'email', v_target.email,
        'blockers', v_blockers,
        'counts', jsonb_build_object(
            'posts',            (select count(*) from public.posts where author_id = p_user_id),
            'claims_on_posts',  (select count(*) from public.claims c
                                  join public.posts p on p.id = c.post_id
                                 where p.author_id = p_user_id),
            'claims_made',      (select count(*) from public.claims where claimer_id = p_user_id),
            'messages',         (select count(*) from public.claim_messages where sender_id = p_user_id),
            'follows',          (select count(*) from public.follows
                                 where follower_id = p_user_id or following_id = p_user_id),
            'group_memberships',(select count(*) from public.group_members where user_id = p_user_id),
            'solo_groups',      (select count(*) from public.groups g
                                 where g.created_by = p_user_id
                                   and not exists (select 1 from public.group_members gm
                                                   where gm.group_id = g.id and gm.user_id <> p_user_id)),
            'reports_filed',    (select count(*) from public.reports where reporter_id = p_user_id)
        ));
end;
$$;

revoke all on function public.admin_user_delete_preview(uuid) from public, anon;
grant execute on function public.admin_user_delete_preview(uuid) to authenticated;

-- Do it.
--
-- Re-checks every guard rather than trusting that the preview was consulted: the
-- preview is a UI convenience, this is the decision.
create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_target public.users;
    v_email  text;
    v_view   jsonb;
begin
    if not public.is_admin_user() then
        return jsonb_build_object('success', false, 'error', 'Admins only');
    end if;

    select * into v_target from public.users where id = p_user_id;
    if not found then
        return jsonb_build_object('success', false, 'error', 'No such user');
    end if;

    v_view := public.admin_user_delete_preview(p_user_id);
    if jsonb_array_length(v_view -> 'blockers') > 0 then
        return jsonb_build_object('success', false,
            'error', (v_view -> 'blockers' -> 0 ->> 'message'),
            'blockers', v_view -> 'blockers');
    end if;

    v_email := lower(btrim(v_target.email));

    -- 1. Attribution that survives the person. Nulling keeps the moderation
    --    record — a post really was removed, a report really was reviewed —
    --    while dropping the name attached to it.
    update public.posts         set deleted_by = null where deleted_by = p_user_id;
    update public.reports       set reviewed_by = null where reviewed_by = p_user_id;
    update public.group_members set removed_by = null where removed_by = p_user_id;

    -- 2. The invite list. Their own row goes, or the address stays invited and
    --    they can simply sign up again — which would make this button a no-op
    --    from the player's point of view.
    delete from public.invites
     where accepted_user_id = p_user_id
        or lower(btrim(email)) = v_email;

    -- Invites THEY sent stay, so the people they invited keep their access. The
    -- row becomes admin-seeded. Where an equivalent seeded row already exists for
    -- that address, nulling would collide with invites_admin_email_uniq, so the
    -- duplicate is dropped instead.
    delete from public.invites i
     where i.inviter_id = p_user_id
       and exists (select 1 from public.invites j
                    where j.inviter_id is null
                      and lower(btrim(j.email)) = lower(btrim(i.email)));
    update public.invites
       set inviter_id = null, source = 'admin'
     where inviter_id = p_user_id;

    -- 3. Their data, children before parents.
    --
    -- posts and claims have their own dependents, and NOT every one of them
    -- belongs to the player being deleted: another player's notification can
    -- point at this player's post, and responsiveness_log rows key on both. Those
    -- have to go first or the delete fails on a foreign key — which is exactly how
    -- notifications_claim_id_fkey surfaced when this was first tested against real
    -- data. A notification about a post that no longer exists is not a loss.
    delete from public.notifications
     where user_id = p_user_id
        or post_id in (select id from public.posts where author_id = p_user_id)
        or claim_id in (
            select c.id from public.claims c where c.claimer_id = p_user_id
            union
            select c.id from public.claims c
              join public.posts p on p.id = c.post_id
             where p.author_id = p_user_id);

    delete from public.responsiveness_log
     where poster_id = p_user_id
        or post_id in (select id from public.posts where author_id = p_user_id)
        or claim_id in (
            select c.id from public.claims c where c.claimer_id = p_user_id
            union
            select c.id from public.claims c
              join public.posts p on p.id = c.post_id
             where p.author_id = p_user_id);

    -- claim_messages.claim_id cascades, so only their own messages on claims that
    -- survive need removing by hand.
    delete from public.claim_messages where sender_id = p_user_id;

    delete from public.claims where claimer_id = p_user_id;
    delete from public.claims where post_id in (select id from public.posts where author_id = p_user_id);

    delete from public.post_views where user_id = p_user_id;
    delete from public.post_views where post_id in (select id from public.posts where author_id = p_user_id);
    delete from public.notify_me  where user_id = p_user_id;
    delete from public.notify_me  where post_id in (select id from public.posts where author_id = p_user_id);

    delete from public.posts where author_id = p_user_id;

    delete from public.group_members where user_id = p_user_id;
    -- Only groups nobody else is in — the preview refuses the rest.
    delete from public.group_members
     where group_id in (select id from public.groups where created_by = p_user_id);
    delete from public.groups where created_by = p_user_id;

    delete from public.follows where follower_id = p_user_id or following_id = p_user_id;
    delete from public.reports where reporter_id = p_user_id;
    -- target_id is not a foreign key, so reports ABOUT them would otherwise
    -- dangle pointing at an id that no longer resolves.
    delete from public.reports where target_id = p_user_id;
    delete from public.feedback where user_id = p_user_id;
    delete from public.responsiveness_log where poster_id = p_user_id;
    delete from public.notifications where user_id = p_user_id;
    delete from public.notification_preferences where user_id = p_user_id;

    delete from public.users where id = p_user_id;

    -- 4. The login last. Without this they could sign in again and, since the
    --    profile is gone, be sent straight into onboarding.
    delete from auth.users where id = p_user_id;

    return jsonb_build_object('success', true, 'email', v_email);
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
