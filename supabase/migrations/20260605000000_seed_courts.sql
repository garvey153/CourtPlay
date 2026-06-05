-- Canonical seed for the courts master list (Westport-area launch venues).
-- Idempotent: guarded by NOT EXISTS on name, so re-running creates no duplicates.
-- (The courts table has no unique constraint on name, so ON CONFLICT can't be used here.)
-- On the existing remote these rows already exist (seeded 2026-04-05), so this is a
-- no-op there; it exists so the court list is reproducible on any fresh environment.
insert into public.courts (name, area, active)
select v.name, v.area, true
from (values
  ('Assumption Catholic School', 'Westport Center'),
  ('Bedford Middle School', 'Westport Center'),
  ('Compo Beach Tennis', 'Compo Beach'),
  ('Greens Farms Tennis', 'Greens Farms'),
  ('Longshore Tennis Club', 'Saugatuck'),
  ('Saugatuck Elementary', 'Saugatuck'),
  ('Sherwood Island', 'Sherwood Island'),
  ('Staples High School', 'Westport Center'),
  ('Westport Tennis Club', 'Westport Center'),
  ('YMCA of Western CT', 'Westport Center')
) as v(name, area)
where not exists (
  select 1 from public.courts c where c.name = v.name
);
