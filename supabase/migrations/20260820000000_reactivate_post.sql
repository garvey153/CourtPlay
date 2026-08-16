-- Put an expired regular-play post back on the feed.
--
-- A regular_game post carries expires_at = created_at + 30 days and no game
-- date. The expire-regular-game-posts cron flips it to 'expired' once that
-- passes:
--
--   update public.posts set status = 'expired'
--    where status = 'active' and post_type = 'regular_game'
--      and expires_at is not null and expires_at < now()
--
-- SO SETTING status BACK TO 'active' ON ITS OWN DOES NOTHING USEFUL. The post
-- returns to the feed and the next cron tick expires it again — the change looks
-- like it worked and then quietly undoes itself. expires_at has to move with it,
-- which is the reason this is a function rather than a client-side update.
--
-- Editing a post does not reset expires_at either (post-new.tsx only sets it on
-- insert), so before this there was no way back for an expired regular post.
create or replace function public.reactivate_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_post public.posts;
begin
    select * into v_post from public.posts where id = p_post_id;
    if not found then
        return jsonb_build_object('success', false, 'error', 'No such post');
    end if;

    -- Ownership, not admin: this is the author's own post management.
    if v_post.author_id is distinct from auth.uid() then
        return jsonb_build_object('success', false, 'error', 'That is not your post');
    end if;

    -- sub_need posts expire at their game start, so "reactivating" one would put
    -- a post for a game that has already happened back on the feed. Those get
    -- edited to a new date instead.
    if v_post.post_type <> 'regular_game' then
        return jsonb_build_object('success', false,
            'error', 'Only regular play posts can be reactivated. Edit the date instead.');
    end if;

    if v_post.status = 'active' then
        return jsonb_build_object('success', false, 'error', 'That post is already active');
    end if;

    if v_post.status <> 'expired' then
        -- Deleted and pending are deliberately not revivable here.
        return jsonb_build_object('success', false, 'error', 'That post cannot be reactivated');
    end if;

    -- The same 30 days a new post gets, measured from now.
    update public.posts
       set status = 'active',
           expires_at = now() + interval '30 days'
     where id = p_post_id;

    return jsonb_build_object('success', true, 'expires_at', now() + interval '30 days');
end;
$$;

revoke all on function public.reactivate_post(uuid) from public, anon;
grant execute on function public.reactivate_post(uuid) to authenticated;
