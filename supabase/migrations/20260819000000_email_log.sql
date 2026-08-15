-- What Resend actually said, kept where it can be read.
--
-- Every email in the system goes through send-email, which returns Resend's
-- response to its caller and then forgets it. When an invite does not arrive
-- there is currently no way to tell "Resend rejected it" from "Resend accepted
-- it and the mail is in spam" — the two look identical from outside, and they
-- need completely different fixes.
--
-- Edge function logs would carry this, but they are only readable in the
-- dashboard and they roll off. A table is queryable, which is the point: this
-- exists to be looked at while something is broken.
create table if not exists public.email_log (
    id          uuid primary key default gen_random_uuid(),
    to_email    text        not null,
    subject     text,
    ok          boolean     not null,
    -- Resend's HTTP status, or null if the request never completed.
    status      integer,
    -- Resend's id on success, its error body on failure. Truncated: this is a
    -- diagnostic, not an archive.
    detail      text,
    created_at  timestamptz not null default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);

alter table public.email_log enable row level security;

-- No policy for anyone. Service role bypasses RLS to write; admins read through
-- the function below. Recipient addresses are the whole content of this table,
-- so it is not something to expose to authenticated users generally.
revoke all on table public.email_log from public, anon, authenticated;

create or replace function public.admin_get_email_log(p_limit integer default 50)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
    select case when not public.is_admin_user() then '[]'::jsonb else coalesce(
        (select jsonb_agg(row_to_json(t) order by t.created_at desc)
         from (select id, to_email, subject, ok, status, detail, created_at
               from public.email_log
               order by created_at desc
               limit greatest(1, least(coalesce(p_limit, 50), 200))) t),
        '[]'::jsonb) end;
$$;

revoke all on function public.admin_get_email_log(integer) from public, anon;
grant execute on function public.admin_get_email_log(integer) to authenticated;
