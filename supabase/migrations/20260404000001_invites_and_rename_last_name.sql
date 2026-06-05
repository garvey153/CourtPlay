-- Rename last_name_initial → last_name (app code uses last_name throughout)
alter table public.users rename column last_name_initial to last_name;

-- Invites table — stores outbound invite emails for future edge-function delivery
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid references public.users not null,
  email text not null,
  sent_at timestamptz default now(),
  unique(inviter_id, email)
);

alter table public.invites enable row level security;

create policy "Users insert own invites" on public.invites
  for insert with check (auth.uid() = inviter_id);

create policy "Users read own invites" on public.invites
  for select using (auth.uid() = inviter_id);
