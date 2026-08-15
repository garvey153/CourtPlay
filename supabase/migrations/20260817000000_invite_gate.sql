-- ============================================================
-- Closed beta, part 2 of 2: the gate.
--
-- Applied AFTER the list is seeded and the frontend is deployed, so it never
-- turns away someone the app had already welcomed.
--
-- Rollback is `drop trigger users_require_invite on public.users;` — instant, no
-- data change, exactly today's behaviour restored. That property is why this is
-- a trigger on the table rather than a rewrite of profile creation into an RPC:
--
--   * A trigger covers EVERY insert path. Gating inside one RPC means dropping
--     the insert policy as well, and then any future definer function, admin
--     tool or fix-up script silently loses the rule.
--   * The client keeps working unchanged. onboarding's handleFinish() calls
--     .upsert(), which is INSERT for a new profile and UPDATE for an edit;
--     dropping the insert policy would reject the whole statement even when the
--     conflict arm would have been taken, locking out any existing member who
--     revisits /onboarding.
--   * It fails closed, whatever the caller sends.
-- ============================================================

create or replace function public.enforce_invite_on_profile_create()
returns trigger
language plpgsql
-- SECURITY DEFINER is required to READ public.invites, not to write users. The
-- invites SELECT policy is `auth.uid() = inviter_id`, and the person being gated
-- is the INVITEE, not the inviter. As security invoker this function cannot see
-- the invite that permits them, so every legitimately invited user is rejected —
-- and it looks like it works until a real invitee tries it.
security definer
set search_path = public
as $$
declare
    v_uid   uuid := auth.uid();
    v_email text;
begin
    -- MUST BE FIRST.
    --
    -- BEFORE INSERT fires on the ON CONFLICT DO UPDATE arm too: Postgres runs
    -- row triggers against the proposed row BEFORE it detects a conflict. The
    -- trigger's effects are discarded if the update path is taken, but the body
    -- has already run — so any check above this line raises for an existing
    -- member re-running onboarding's upsert.
    --
    -- This check, not the backfill, is what protects existing members. Deleting
    -- every row in `invites` must not lock anyone out.
    if exists (select 1 from public.users u where u.id = new.id) then
        return new;
    end if;

    -- No auth context: service_role, edge functions, migrations, seed scripts.
    -- anon never reaches here — "Users insert own profile" requires
    -- auth.uid() = id, which is NULL for anon.
    if v_uid is null then
        return new;
    end if;

    -- Admins can create a profile for anyone.
    if public.is_admin_user() then
        return new;
    end if;

    -- NOT new.email. That arrives from the browser, so checking it would let
    -- anyone type an invited person's address into the request body and walk in.
    -- auth.users is the only trustworthy source, and RLS already pins new.id to
    -- auth.uid().
    select lower(btrim(au.email)) into v_email from auth.users au where au.id = new.id;
    if v_email is null or v_email = '' then
        v_email := lower(btrim(auth.jwt() ->> 'email'));
    end if;

    -- Phone-only and anonymous accounts have no email. Fail closed rather than
    -- letting an empty string match nothing and fall through.
    if v_email is null or v_email = '' then
        raise exception 'CourtPlay is invite-only right now.'
            using errcode = '42501', hint = 'no_email';
    end if;

    if not public.is_email_invited(v_email) then
        raise exception 'CourtPlay is invite-only right now.'
            using errcode = '42501', hint = 'not_invited';
    end if;

    -- Pin the stored email to the authenticated one. public.users.email is
    -- otherwise free text — the UPDATE policy has no WITH CHECK, so its USING
    -- clause is reused and a client can write anything there.
    new.email := v_email;

    -- Stamping the invite accepted happens AFTER the insert, not here: this runs
    -- before the public.users row exists, and invites.accepted_user_id has a
    -- foreign key to it.
    return new;
end;
$$;

-- Mark the invite used. Separate trigger because it can only run once the row it
-- points at exists.
create or replace function public.stamp_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.invites i
    set accepted_at = now(), accepted_user_id = new.id
    where lower(btrim(i.email)) = lower(btrim(new.email)) and i.accepted_at is null;
    return null;
end;
$$;

-- errcode 42501 (insufficient_privilege) surfaces as HTTP 403 rather than a
-- generic 400, and `hint` reaches the client in the JSON body — so the app can
-- branch on 'not_invited' without matching prose.
drop trigger if exists users_require_invite on public.users;
create trigger users_require_invite
    before insert on public.users
    for each row execute function public.enforce_invite_on_profile_create();

drop trigger if exists users_stamp_invite on public.users;
create trigger users_stamp_invite
    after insert on public.users
    for each row execute function public.stamp_invite_accepted();
