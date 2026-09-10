-- 0001_schema.sql  Credit Count: tables, constraints and indexes.
--
-- Rule for this migration: no access decision lives here. Only the shape of the data.
-- Access lives in 0002. This is deliberate: a security reviewer reads a single file.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
-- One row per account. The id is the same as auth.users, so there is no
-- "which profile belongs to which login": it is the same key.
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text        not null,
  role                text        not null default 'enthusiast',
  show_on_leaderboard boolean     not null default false,   -- privacy is the default (SOW 2)
  created_at          timestamptz not null default now(),

  constraint profiles_role_valido    check (role in ('enthusiast','admin')),
  constraint profiles_nome_tamanho   check (char_length(display_name) between 2 and 40),
  constraint profiles_nome_aparado   check (display_name = btrim(display_name))
);

-- ------------------------------------------------------------------- parks
-- Country lives here, never in coasters, so two rows cannot disagree.
create table public.parks (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  country_code char(2)     not null,
  created_at   timestamptz not null default now(),

  constraint parks_nome_tamanho check (char_length(btrim(name)) between 2 and 80),
  constraint parks_pais_iso     check (country_code ~ '^[A-Z]{2}$')
);

-- Without this index, "Alton Towers" and "alton towers" become two parks and the
-- per-park statistic splits. The admin form has an "add new" option,
-- so the door genuinely exists.
create unique index parks_nome_unico on public.parks (lower(btrim(name)));

-- ----------------------------------------------------------- manufacturers
create table public.manufacturers (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now(),

  constraint manufacturers_nome_tamanho check (char_length(btrim(name)) between 2 and 80)
);
create unique index manufacturers_nome_unico on public.manufacturers (lower(btrim(name)));

-- ---------------------------------------------------------------- coasters
create table public.coasters (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  park_id         uuid        not null references public.parks(id)         on delete restrict,
  manufacturer_id uuid                 references public.manufacturers(id) on delete restrict,
  track_type      text        not null,
  retired_at      date,                                     -- retired, not deleted
  created_at      timestamptz not null default now(),

  constraint coasters_nome_tamanho check (char_length(btrim(name)) between 2 and 120),
  -- Closed set. Without this, 'Steel' and 'steel' become two slices of the same thing
  -- and the TDD's line "each coaster lands in one bucket of each grouping" is false.
  constraint coasters_tipo_valido  check (track_type in ('steel','wooden','hybrid'))
);

-- A clone across parks is still fine (Nemesis in two parks is possible),
-- a duplicate within the same park is not.
create unique index coasters_nome_por_parque on public.coasters (park_id, lower(btrim(name)));
create index coasters_por_parque     on public.coasters (park_id);
create index coasters_por_fabricante on public.coasters (manufacturer_id);

-- ------------------------------------------------------------------- rides
create table public.rides (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  -- restrict, not cascade: deleting a coaster must not delete anyone's history
  coaster_id uuid        not null references public.coasters(id) on delete restrict,
  ridden_on  date        not null default current_date,
  note       text,
  created_at timestamptz not null default now(),

  constraint rides_data_nao_futura check (ridden_on <= current_date),
  -- the SOW says "short note"; with no cap someone pastes a book into a public, width-bound column
  constraint rides_nota_tamanho    check (note is null or char_length(note) <= 280)
);

-- There is NO unique on (user_id, coaster_id, ridden_on): FR3 requires that riding
-- again on the same day is allowed.
create index rides_por_usuario on public.rides (user_id, ridden_on desc);
create index rides_credito     on public.rides (user_id, coaster_id);

-- --------------------------------------------------------- catalogue_audit
-- survivor_id and loser_id are NOT foreign keys on purpose: the loser
-- stops existing in the merge, and the audit row needs to outlive it.
create table public.catalogue_audit (
  id          bigint      generated always as identity primary key,
  action      text        not null,
  actor_id    uuid                 references public.profiles(id) on delete set null,
  survivor_id uuid        not null,
  loser_id    uuid        not null,
  loser_name  text        not null,
  rides_moved integer     not null,
  created_at  timestamptz not null default now(),

  constraint catalogue_audit_acao_valida check (action in ('merge'))
);
