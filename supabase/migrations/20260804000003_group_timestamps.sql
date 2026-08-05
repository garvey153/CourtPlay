-- ============================================================
-- Expose the two timestamps the feed banners key off.
--
-- "You were added to a group" and "a group was closed" are shown at the top of
-- the feed, which means the feed has to know when each happened. joined_at is
-- the caller's own membership row; closed_at is the group's.
--
-- Deliberately derived from state rather than from an events table. A banner
-- for being REMOVED is therefore not possible here — once you are removed there
-- is no row left to derive it from — so removal is push/email only, and the
-- group simply disappearing is the in-app signal. Adding that banner later
-- means a group_events table, which is a bigger change than it looks and not
-- worth it until the rest is in use.
-- ============================================================

create or replace function public.get_my_groups()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    -- Not my_active_group_ids(): a closed group must stay on the profile,
    -- rendered void, until its remaining members clear it.
    select coalesce(jsonb_agg(g order by g.is_closed, g.name), '[]'::jsonb)
    from (
        select
            gr.id,
            gr.name,
            gr.details,
            (gr.created_by = auth.uid()) as is_creator,
            (gr.closed_at is not null) as is_closed,
            gr.closed_at,
            gm.created_at as joined_at,
            (select count(*)::integer from public.group_members m where m.group_id = gr.id) as member_count,
            coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'photo_url', u.photo_url
                ) order by u.first_name)
                from public.group_members m2
                join public.users u on u.id = m2.user_id
                where m2.group_id = gr.id and u.deleted_at is null
            ), '[]'::jsonb) as members
        from public.groups gr
        join public.group_members gm on gm.group_id = gr.id and gm.user_id = auth.uid()
        where gr.deleted_at is null
    ) g;
$$;
