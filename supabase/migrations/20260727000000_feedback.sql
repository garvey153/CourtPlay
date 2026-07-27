-- ============================================================
-- Feedback — players submit free-form feedback (title + details)
-- from the Profile screen. Admins review it in the Reports tab's
-- Feedback section and can delete entries. New submissions notify
-- admins (in-feed banner + push + email).
-- ============================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users not null,
  title text not null,
  details text,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

-- Players may submit their own feedback...
create policy "Users insert own feedback" on public.feedback
  for insert with check (auth.uid() = user_id);

-- ...and read it back (harmless; there is no player-facing list yet).
create policy "Users read own feedback" on public.feedback
  for select using (auth.uid() = user_id);

-- Admins see everything and can delete.
create policy "Admins full access feedback" on public.feedback
  for all using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

grant select, insert, delete on public.feedback to authenticated;

-- Insert via a security-definer RPC so the client doesn't hit the
-- .insert().select() RLS-returning gotcha, and title is validated server-side.
create or replace function public.submit_feedback(p_title text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  insert into public.feedback (user_id, title, details)
  values (auth.uid(), trim(p_title), nullif(trim(p_details), ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- Lock to authenticated: Supabase default-grants anon directly, so revoke that too.
revoke all on function public.submit_feedback(text, text) from public, anon;
grant execute on function public.submit_feedback(text, text) to authenticated;
