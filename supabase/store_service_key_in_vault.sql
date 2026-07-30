-- ============================================================================
-- STEP 1 of 2 — store the service role key in Supabase Vault.
--
-- Not a migration. Paste into the Supabase SQL editor and run by hand; the CLI
-- must never apply this, because it needs a secret substituted in first.
--
-- Replace [service_role_key] with the legacy `service_role` JWT (starts with
-- eyJ) from Project Settings → API Keys. It must be that key specifically: it's
-- the value Supabase injects into edge functions as SUPABASE_SERVICE_ROLE_KEY,
-- and the functions compare the incoming token against exactly it. A new-style
-- sb_secret_… key fails the comparison and every scheduled run 401s in silence.
--
-- NEVER COMMIT A FILLED-IN COPY. Work on a copy outside the repo, run it, then
-- delete that copy — the key belongs in Vault, not in git. The placeholder in
-- this file is the committed state.
--
-- Idempotent: re-running replaces the stored value rather than erroring on the
-- unique name, so this doubles as the key-rotation procedure. Because
-- register_cron_jobs.sql resolves the secret by name at job run time, rotating
-- the key is this file alone — no job needs re-registering.
--
-- Then run: register_cron_jobs.sql (holds no secret).
-- ============================================================================

create extension if not exists supabase_vault with schema vault;

do $$
declare
    v_id uuid;
    v_key text := '[service_role_key]';
    v_name text := 'service_role_key';
    v_desc text := 'Legacy service_role JWT. Used by pg_cron to invoke notification edge functions.';
begin
    if v_key = '[' || 'service_role_key]' then
        raise exception 'Placeholder not replaced — run fill-service-key.py first.';
    end if;

    select id into v_id from vault.secrets where name = v_name;

    if v_id is null then
        perform vault.create_secret(v_key, v_name, v_desc);
        raise notice 'Created vault secret %', v_name;
    else
        perform vault.update_secret(v_id, v_key, v_name, v_desc);
        raise notice 'Updated existing vault secret %', v_name;
    end if;
end $$;

-- ── Verify without printing the key ─────────────────────────────────────────
-- key_len should be ~200+ for a service_role JWT. If role_claim is anything
-- other than service_role, stop: the scheduled jobs will 401 silently.
select
    name,
    length(decrypted_secret)                                        as key_len,
    convert_from(
        decode(
            -- middle JWT segment, padded to a multiple of 4 for base64
            translate(split_part(decrypted_secret, '.', 2), '-_', '+/')
                || repeat('=', (4 - length(split_part(decrypted_secret, '.', 2)) % 4) % 4),
            'base64'
        ),
        'utf8'
    )::jsonb ->> 'role'                                             as role_claim,
    updated_at
from vault.decrypted_secrets
where name = 'service_role_key';
