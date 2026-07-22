-- Posters now enter an area (town) alongside a custom court name. Record it on the
-- submission so an admin can pre-fill the area when approving the court.
alter table public.custom_court_submissions add column if not exists area text;
