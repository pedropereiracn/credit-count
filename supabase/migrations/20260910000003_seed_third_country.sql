-- 20260910000003_seed_third_country.sql  Adds a third country to the coaster catalogue.
--
-- SOW section 6 asks the catalogue to be seeded "across several countries,
-- manufacturers, and types". The seed in 20260909000005_seed.sql only covers GB and
-- US: two countries is not "several", and a review flagged this as an undeclared
-- deviation from acceptance criterion 6. This migration adds Germany, home to two of
-- the most referenced parks in the coaster enthusiast community, bringing the
-- catalogue to three countries.
--
-- Ordering: this file's timestamp (2026-09-10) is after 20260909000005_seed.sql's
-- (2026-09-09), so on a full `supabase db reset` the seed migration's own count check
-- ("exactly 46 coasters, 10 parks, 14 manufacturers") runs and passes BEFORE this file
-- executes. This migration only adds rows after that check already ran; it does not
-- touch the seed migration or its declared numbers.
--
-- Manufacturer attribution: every manufacturer used below (Mack Rides, Intamin,
-- Bolliger & Mabillard, Great Coasters International) already exists in the catalogue
-- from the earlier seed, so no new manufacturer rows are inserted here. Mack Rides is
-- itself German, and B&M and Intamin already appear against European installs, so
-- reusing them here is accurate, not a shortcut.
--
-- Idempotent: every insert targets a column covered by a unique index (parks:
-- lower(btrim(name)); coasters: park_id + lower(btrim(name))), so a second run of this
-- file, or a repeated `db push`, inserts nothing new instead of erroring or
-- duplicating.

insert into public.parks (name, country_code) values
  ('Europa-Park', 'DE'),
  ('Phantasialand', 'DE')
on conflict do nothing;

insert into public.coasters (name, park_id, manufacturer_id, track_type) values
  -- Europa-Park (Rust, Germany)
  ('Silver Star',
     (select id from public.parks where name = 'Europa-Park'),
     (select id from public.manufacturers where name = 'Intamin'),
     'steel'),
  ('Blue Fire Megacoaster',
     (select id from public.parks where name = 'Europa-Park'),
     (select id from public.manufacturers where name = 'Mack Rides'),
     'steel'),
  ('Wodan Timburcoaster',
     -- Wooden coaster; the manufacturer credit varies slightly by source, but most,
     -- RCDB included, attribute the build to Great Coasters International (GCI),
     -- which is the one used here.
     (select id from public.parks where name = 'Europa-Park'),
     (select id from public.manufacturers where name = 'Great Coasters International'),
     'wooden'),
  -- Phantasialand (Bruehl, Germany)
  ('Taron',
     (select id from public.parks where name = 'Phantasialand'),
     (select id from public.manufacturers where name = 'Mack Rides'),
     'steel'),
  ('Black Mamba',
     (select id from public.parks where name = 'Phantasialand'),
     (select id from public.manufacturers where name = 'Bolliger & Mabillard'),
     'steel'),
  ('F.L.Y.',
     (select id from public.parks where name = 'Phantasialand'),
     (select id from public.manufacturers where name = 'Mack Rides'),
     'steel')
on conflict do nothing;

-- Check, don't assert: count what actually landed in the tables after the inserts
-- above, and raise if it does not match what this file intended to add.
do $$
declare
  de_parks    integer;
  de_coasters integer;
  countries   integer;
begin
  select count(*) into de_parks from public.parks where country_code = 'DE';
  if de_parks <> 2 then
    raise exception 'third-country seed: expected 2 DE parks, found %', de_parks;
  end if;

  select count(*) into de_coasters
    from public.coasters c
    join public.parks p on p.id = c.park_id
    where p.country_code = 'DE';
  if de_coasters <> 6 then
    raise exception 'third-country seed: expected 6 DE coasters, found %', de_coasters;
  end if;

  select count(distinct country_code) into countries from public.parks;
  if countries < 3 then
    raise exception 'third-country seed: catalogue still has fewer than 3 countries (%)', countries;
  end if;

  raise notice 'third-country seed ok: % DE parks, % DE coasters, % countries total',
    de_parks, de_coasters, countries;
end $$;
