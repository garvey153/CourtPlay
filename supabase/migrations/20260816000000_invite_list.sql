-- ============================================================
-- Closed beta, part 1 of 2: the invite list.
--
-- This migration is deliberately INERT — it reshapes `invites`, fills it with
-- everyone who is already a member, and adds the functions the app and admin
-- will call. It does NOT gate anything. The gate is a trigger in part 2, kept
-- separate so it can be created once the list is seeded and the frontend is
-- deployed, and so `drop trigger` is an instant rollback that reasons about
-- nothing else.
--
-- `invites` held zero rows in production when this was written, so the reshape
-- is free.
-- ============================================================

-- ── Reshape ─────────────────────────────────────────────────────────────────

-- Admin-seeded rows have no human inviter. NULL says so honestly, rather than
-- attributing the invite to whichever admin happened to paste the list.
alter table public.invites alter column inviter_id drop not null;

alter table public.invites
    add column if not exists source text not null default 'member'
        check (source in ('member', 'admin', 'backfill')),
    add column if not exists accepted_at timestamptz,
    add column if not exists accepted_user_id uuid references public.users;

-- The original unique(inviter_id, email) is case-sensitive, so Sara@x.com and
-- sara@x.com were two invites for one person.
alter table public.invites drop constraint if exists invites_inviter_id_email_key;
create unique index if not exists invites_inviter_email_uniq
    on public.invites (inviter_id, lower(btrim(email)));

-- NULLs are distinct in a unique index, so the index above places no constraint
-- at all on seeded rows. This is what makes re-pasting a list idempotent.
create unique index if not exists invites_admin_email_uniq
    on public.invites (lower(btrim(email))) where inviter_id is null;

-- The gate's hot path. The composite index above cannot serve it: inviter_id is
-- the leading column, and the gate looks up by email alone.
create index if not exists invites_email_lower_idx
    on public.invites (lower(btrim(email)));

-- ── Close the self-invite path ──────────────────────────────────────────────
--
-- Until now the only thing stopping a signed-in non-member from inviting
-- THEMSELVES was inviter_id's foreign key to public.users: they have no row, so
-- the insert failed. Dropping NOT NULL above weakens that by accident, and
-- "sign up, invite yourself, onboard" is the whole gate defeated.
--
-- `auth.uid() = inviter_id` alone would still reject a null inviter_id, since
-- NULL = anything is NULL rather than true — but that is a subtlety to rely on,
-- so the intent is written down.
drop policy if exists "Users insert own invites" on public.invites;
create policy "Users insert own invites" on public.invites
    for insert with check (auth.uid() = inviter_id and inviter_id is not null);

-- Admins manage the whole list.
drop policy if exists "Admins full access invites" on public.invites;
create policy "Admins full access invites" on public.invites
    for all using (public.is_admin_user()) with check (public.is_admin_user());

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- Every current member becomes an accepted invite, so `invites` is the single
-- answer to "who is allowed in" rather than something to be unioned with
-- `users` by every future caller. It also means a member whose profile is ever
-- deleted can re-onboard.
--
-- Sourced from auth.users, NOT public.users.email: the latter is client-written
-- and could disagree with the address the gate will actually compare against.
--
-- NOTE this is not what protects existing members — the trigger in part 2 does
-- that by checking for an existing row first. If the backfill were the safety
-- net, a botched backfill would be a mass lockout.
insert into public.invites (inviter_id, email, source, accepted_at, accepted_user_id)
select null, lower(btrim(au.email)), 'backfill', coalesce(u.created_at, now()), u.id
from public.users u
join auth.users au on au.id = u.id
where au.email is not null and btrim(au.email) <> ''
on conflict (lower(btrim(email))) where inviter_id is null do nothing;

-- ── Is this address invited? ────────────────────────────────────────────────
--
-- One definition, called by both the gate and the client-facing status RPC, so
-- the two cannot drift apart on normalisation and start disagreeing about who
-- is allowed in.
--
-- Revoked from authenticated deliberately: exposed, it is an email-enumeration
-- oracle against the invite list. Only the two security-definer callers use it.
create or replace function public.is_email_invited(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.invites i
        where lower(btrim(i.email)) = lower(btrim(p_email))
    );
$$;

revoke all on function public.is_email_invited(text) from public, anon, authenticated;

-- ── Am I invited? ───────────────────────────────────────────────────────────
--
-- So the app can show a friendly screen instead of letting someone fill in three
-- steps of onboarding and fail at the end.
--
-- TAKES NO ARGUMENTS, and must not gain any. An is_email_invited(p_email)
-- exposed to authenticated callers would let anyone with a beta account read the
-- invite list one guess at a time.
create or replace function public.am_i_invited()
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_uid   uuid := auth.uid();
    v_email text;
begin
    if v_uid is null then
        raise exception 'Not authenticated';
    end if;

    -- Already a member: always true, whatever the list says. Keeps the
    -- invite-only screen from ever showing to someone who is already in.
    if exists (select 1 from public.users u where u.id = v_uid) then
        return true;
    end if;

    select lower(btrim(au.email)) into v_email from auth.users au where au.id = v_uid;
    if v_email is null or v_email = '' then
        -- Fallback for the window where the session exists but the row read
        -- misses. Stale after an email change until the token refreshes, which
        -- is why auth.users is asked first.
        v_email := lower(btrim(auth.jwt() ->> 'email'));
    end if;
    if v_email is null or v_email = '' then
        return false;
    end if;

    return public.is_email_invited(v_email);
end;
$$;

revoke all on function public.am_i_invited() from public, anon;
grant execute on function public.am_i_invited() to authenticated;

-- ── Seed a list from Admin ──────────────────────────────────────────────────
--
-- Paste-a-list, so it has to be idempotent and it has to say what it did with
-- the entries it refused rather than dropping them silently.
create or replace function public.admin_seed_invites(p_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_clean    text[];
    v_rejected text[];
    v_inserted integer := 0;
    -- Deliberately loose: this is a typo catcher, not an RFC 5322 parser. The
    -- address either receives the invite or it does not.
    v_re constant text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
begin
    if not public.is_admin_user() then
        raise exception 'Admin only';
    end if;

    with norm as (
        select distinct lower(btrim(x)) as email
        from unnest(coalesce(p_emails, '{}'::text[])) as x
        where btrim(x) <> ''
    )
    select coalesce(array_agg(email) filter (where email ~ v_re), '{}'),
           coalesce(array_agg(email) filter (where email !~ v_re), '{}')
    into v_clean, v_rejected
    from norm;

    -- Index inference against invites_admin_email_uniq, so re-pasting the same
    -- list is a no-op rather than an error.
    insert into public.invites (inviter_id, email, source)
    select null, e, 'admin' from unnest(v_clean) as e
    on conflict (lower(btrim(email))) where inviter_id is null do nothing;

    get diagnostics v_inserted = row_count;

    return jsonb_build_object(
        'submitted', coalesce(array_length(p_emails, 1), 0),
        'inserted', v_inserted,
        'already_there', coalesce(array_length(v_clean, 1), 0) - v_inserted,
        'rejected', to_jsonb(v_rejected),
        'total_invited', (select count(distinct lower(btrim(email))) from public.invites)
    );
end;
$$;

revoke all on function public.admin_seed_invites(text[]) from public, anon;
grant execute on function public.admin_seed_invites(text[]) to authenticated;
