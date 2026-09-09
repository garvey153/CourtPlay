-- ============================================================
-- Per-invite tokens, so the invite email stops looking like phishing.
--
-- The link was `/signup?email=<their address>`. Putting the recipient's own
-- address in a clickable link to an account-creation page is the shape of a
-- credential-harvest email, and spam filters weigh it heavily — which is the
-- point here. src/lib/beta.ts considered a token when the closed beta was built
-- and rejected it for good reason: the parameter is a visibility marker, not a
-- gate, and making it unguessable buys no security while the trigger on
-- public.users is what actually decides who gets a profile. That reasoning still
-- holds. DELIVERABILITY is the new reason, and it is unrelated to security.
--
-- The token therefore carries no authority whatsoever. It resolves to the
-- address the invite was sent to and nothing else — information the holder
-- already has, since it arrived in their inbox.
-- ============================================================

alter table public.invites
    add column if not exists token uuid not null default gen_random_uuid();

-- Unique so the token identifies exactly one invite, and so a lookup by token is
-- an index scan rather than a sequential one.
create unique index if not exists invites_token_key on public.invites (token);

-- ============================================================
-- Resolve a token to the address it was issued for.
--
-- ANON-CALLABLE BY DESIGN. The whole point is that it runs before sign-in — the
-- caller has no session yet, that is why they are here. It joins the small set
-- of deliberately open doors alongside get_post_by_id and is_admin_user; see
-- 20260730000000_revoke_anon_execute_on_rpcs.sql, which allowlists by name and
-- so does not cover functions created after it.
--
-- What it can leak: one email address, to someone who already holds a 122-bit
-- random token that was mailed to that address. Brute force is not a threat at
-- that width. It returns null rather than raising for an unknown token, so a
-- stale or mistyped link degrades to the ordinary sign-in screen.
--
-- SECURITY DEFINER because the invites SELECT policy is `auth.uid() =
-- inviter_id` and the caller is the INVITEE, not the inviter — as security
-- invoker this returns null for every real invite, which looks like it works
-- until someone actually clicks a link.
-- ============================================================
create or replace function public.invite_email_for_token(p_token uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select i.email
    from public.invites i
    where i.token = p_token
      -- An accepted invite has done its job. Returning the address for one would
      -- keep a forwarded link prefilling someone else's email forever.
      and i.accepted_at is null
    limit 1;
$$;

-- Explicit rather than inherited. Postgres grants EXECUTE to public by default
-- and Supabase grants anon directly, so "it works" says nothing about intent —
-- state it, so the next audit reads a decision instead of an accident.
revoke all on function public.invite_email_for_token(uuid) from public;
grant execute on function public.invite_email_for_token(uuid) to anon, authenticated;

do $$
begin
    raise notice 'invites.token added; invite_email_for_token is anon-callable by design.';
end $$;
