-- custom_court_submissions is admin-only under RLS, so a regular user posting a
-- custom court could never record a pending submission (the insert was silently
-- denied). Record it via a SECURITY DEFINER RPC any authenticated user may call.

-- Ensure the area column exists (self-contained; also added in 20260718000001).
alter table public.custom_court_submissions add column if not exists area text;

create or replace function public.record_custom_court_submission(p_name text, p_area text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
  v_id uuid;
  v_count integer;
  v_alerted boolean;
  v_existing_area text;
begin
  if v_name = '' then
    return;
  end if;

  -- Look up an existing submission for this court name (no ON CONFLICT, so this
  -- doesn't depend on a unique constraint being present on the table).
  select id, submission_count, alerted, area
    into v_id, v_count, v_alerted, v_existing_area
    from public.custom_court_submissions
    where court_name = v_name
    limit 1;

  if v_id is null then
    insert into public.custom_court_submissions (court_name, submission_count, alerted, area, last_submitted_at)
    values (v_name, 1, false, v_area, now());
  else
    update public.custom_court_submissions
      set submission_count = v_count + 1,
          -- Flag for admin review once it crosses the threshold, without re-flagging.
          alerted = case when v_count + 1 >= 3 and v_alerted = false then true else v_alerted end,
          -- Keep the first area on record, backfilling if it was missing.
          area = coalesce(v_existing_area, v_area),
          last_submitted_at = now()
      where id = v_id;
  end if;
end;
$$;

-- Lock down to signed-in users. Postgres grants EXECUTE to PUBLIC by default, and
-- Supabase's default privileges also grant it directly to anon — revoke both.
revoke execute on function public.record_custom_court_submission(text, text) from public, anon;
grant execute on function public.record_custom_court_submission(text, text) to authenticated;
