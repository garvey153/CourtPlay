-- Claim messaging: the claimer sends a message with their claim, and the poster
-- and claimer can exchange replies in a thread. The original message shown in the
-- thread is the post's `notes`; every claim_message is a reply under it.

create table if not exists public.claim_messages (
    id uuid primary key default gen_random_uuid(),
    claim_id uuid references public.claims on delete cascade not null,
    sender_id uuid references public.users not null,
    body text not null,
    created_at timestamptz default now()
);

create index if not exists claim_messages_claim_id_idx on public.claim_messages (claim_id, created_at);

alter table public.claim_messages enable row level security;

-- Only the claimer or the post's author can read/write a claim's messages.
-- (Most access is via the security-definer RPCs below; these policies are a backstop.)
drop policy if exists "claim participants read messages" on public.claim_messages;
create policy "claim participants read messages" on public.claim_messages
    for select using (
        exists (
            select 1 from public.claims c
            join public.posts p on p.id = c.post_id
            where c.id = claim_id and (c.claimer_id = auth.uid() or p.author_id = auth.uid())
        )
    );

drop policy if exists "claim participants insert messages" on public.claim_messages;
create policy "claim participants insert messages" on public.claim_messages
    for insert with check (
        sender_id = auth.uid()
        and exists (
            select 1 from public.claims c
            join public.posts p on p.id = c.post_id
            where c.id = claim_id and (c.claimer_id = auth.uid() or p.author_id = auth.uid())
        )
    );

-- submit_claim now accepts an optional first message from the claimer.
create or replace function submit_claim(p_post_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_post record;
    v_conflict_date date;
    v_conflict_time time;
    v_claim_id uuid;
    v_spots_available integer;
    v_existing_claim_id uuid;
begin
    select * into v_post from public.posts
    where id = p_post_id and status = 'active' and deleted_at is null;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Post not found or no longer active');
    end if;

    select id into v_existing_claim_id
    from public.claims
    where post_id = p_post_id and claimer_id = auth.uid() and status in ('pending', 'approved')
    limit 1;
    if found then
        return jsonb_build_object('success', false, 'error', 'You already have an active claim on this post');
    end if;

    v_spots_available := greatest(0, v_post.spots_total - coalesce(
        (select count(*)::integer from public.claims c
         where c.post_id = p_post_id and c.status in ('pending', 'approved')), 0));
    if v_spots_available <= 0 then
        return jsonb_build_object('success', false, 'error', 'No spots available');
    end if;

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

    insert into public.claims (post_id, claimer_id, status)
    values (p_post_id, auth.uid(), 'pending')
    returning id into v_claim_id;

    -- Store the claimer's opening message, if any.
    if p_message is not null and length(trim(p_message)) > 0 then
        insert into public.claim_messages (claim_id, sender_id, body)
        values (v_claim_id, auth.uid(), trim(p_message));
    end if;

    return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$$;

-- Post a reply in a claim thread (claimer or poster only).
create or replace function send_claim_message(p_claim_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_ok boolean;
    v_id uuid;
begin
    if p_body is null or length(trim(p_body)) = 0 then
        return jsonb_build_object('success', false, 'error', 'Message is empty');
    end if;

    select exists (
        select 1 from public.claims c
        join public.posts p on p.id = c.post_id
        where c.id = p_claim_id and (c.claimer_id = auth.uid() or p.author_id = auth.uid())
    ) into v_ok;

    if not v_ok then
        return jsonb_build_object('success', false, 'error', 'Not allowed');
    end if;

    insert into public.claim_messages (claim_id, sender_id, body)
    values (p_claim_id, auth.uid(), trim(p_body))
    returning id into v_id;

    return jsonb_build_object('success', true, 'message_id', v_id);
end;
$$;

grant execute on function submit_claim(uuid, text) to authenticated;
grant execute on function send_claim_message(uuid, text) to authenticated;

-- Recreate the Activity RPCs to also return each claim's message thread.
create or replace function get_my_posts_with_claims()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    select coalesce(json_agg(post_row order by (post_row->>'created_at') desc), '[]')
    into result
    from (
        select jsonb_build_object(
            'id', p.id,
            'post_type', p.post_type,
            'format', p.format,
            'play_type', p.play_type,
            'duration', p.duration,
            'skill_level', p.skill_level,
            'notes', p.notes,
            'game_date', p.game_date,
            'game_time', p.game_time,
            'location', p.location,
            'custom_court', p.custom_court,
            'preferred_days', p.preferred_days,
            'preferred_times', p.preferred_times,
            'cost', p.cost,
            'original_cost', p.original_cost,
            'spots_total', p.spots_total,
            'status', p.status,
            'created_at', p.created_at,
            'series_id', p.series_id,
            'deleted_at', p.deleted_at,
            'deleted_by', p.deleted_by,
            'spots_available', greatest(0,
                p.spots_total - coalesce(
                    (select count(*)::integer from public.claims c2
                     where c2.post_id = p.id and c2.status in ('pending', 'approved')),
                    0
                )
            ),
            'claims', coalesce(
                (select json_agg(jsonb_build_object(
                    'id', c.id,
                    'status', c.status,
                    'created_at', c.created_at,
                    'claimer_id', c.claimer_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'photo_url', u.photo_url,
                    'skill_level', u.skill_level,
                    'venmo_handle', u.venmo_handle,
                    'phone', u.phone,
                    'messages', coalesce((
                        select json_agg(jsonb_build_object(
                            'id', m.id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at,
                            'first_name', mu.first_name, 'last_name', mu.last_name, 'photo_url', mu.photo_url
                        ) order by m.created_at asc)
                        from public.claim_messages m
                        join public.users mu on mu.id = m.sender_id
                        where m.claim_id = c.id
                    ), '[]')
                ) order by c.created_at asc)
                from public.claims c
                join public.users u on u.id = c.claimer_id
                where c.post_id = p.id
                  and c.status in ('pending', 'approved')),
                '[]'
            )
        ) as post_row
        from public.posts p
        where p.author_id = auth.uid()
    ) sub;

    return result;
end;
$$;

create or replace function get_my_claims_with_posts()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    select coalesce(json_agg(claim_row order by (claim_row->>'created_at') desc), '[]')
    into result
    from (
        select jsonb_build_object(
            'id', c.id,
            'status', c.status,
            'created_at', c.created_at,
            'rejection_reason', c.rejection_reason,
            'post_id', p.id,
            'post_type', p.post_type,
            'post_status', p.status,
            'format', p.format,
            'play_type', p.play_type,
            'duration', p.duration,
            'skill_level', p.skill_level,
            'notes', p.notes,
            'game_date', p.game_date,
            'game_time', p.game_time,
            'location', p.location,
            'custom_court', p.custom_court,
            'cost', p.cost,
            'poster_id', poster.id,
            'poster_first_name', poster.first_name,
            'poster_last_name', poster.last_name,
            'poster_photo_url', poster.photo_url,
            'poster_venmo_handle', poster.venmo_handle,
            'poster_phone', poster.phone,
            'messages', coalesce((
                select json_agg(jsonb_build_object(
                    'id', m.id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at,
                    'first_name', mu.first_name, 'last_name', mu.last_name, 'photo_url', mu.photo_url
                ) order by m.created_at asc)
                from public.claim_messages m
                join public.users mu on mu.id = m.sender_id
                where m.claim_id = c.id
            ), '[]')
        ) as claim_row
        from public.claims c
        join public.posts p on p.id = c.post_id
        join public.users poster on poster.id = p.author_id
        where c.claimer_id = auth.uid()
    ) sub;

    return result;
end;
$$;
