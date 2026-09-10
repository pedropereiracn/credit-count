-- 0001_schema.sql  Credit Count: tabelas, restricoes e indices.
--
-- Regra desta migration: nenhuma decisao de acesso mora aqui. So forma do dado.
-- Acesso vive na 0002. Isso e' de proposito: quem revisa seguranca le um arquivo so.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
-- Uma linha por conta. O id e' o mesmo do auth.users, entao nao existe
-- "qual perfil pertence a qual login": e' a mesma chave.
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text        not null,
  role                text        not null default 'enthusiast',
  show_on_leaderboard boolean     not null default false,   -- privacidade e' o padrao (SOW 2)
  created_at          timestamptz not null default now(),

  constraint profiles_role_valido    check (role in ('enthusiast','admin')),
  constraint profiles_nome_tamanho   check (char_length(display_name) between 2 and 40),
  constraint profiles_nome_aparado   check (display_name = btrim(display_name))
);

-- ------------------------------------------------------------------- parks
-- Pais mora aqui, nunca em coasters, entao duas linhas nao podem discordar.
create table public.parks (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  country_code char(2)     not null,
  created_at   timestamptz not null default now(),

  constraint parks_nome_tamanho check (char_length(btrim(name)) between 2 and 80),
  constraint parks_pais_iso     check (country_code ~ '^[A-Z]{2}$')
);

-- Sem este indice, "Alton Towers" e "alton towers" viram dois parques e a
-- estatistica por parque racha. O formulario de admin tem "adicionar novo",
-- entao a porta existe de verdade.
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
  retired_at      date,                                     -- aposentada, nao apagada
  created_at      timestamptz not null default now(),

  constraint coasters_nome_tamanho check (char_length(btrim(name)) between 2 and 120),
  -- Conjunto fechado. Sem isto, 'Steel' e 'steel' viram duas fatias da mesma coisa
  -- e a frase do TDD "cada coaster cai num balde de cada agrupamento" e' falsa.
  constraint coasters_tipo_valido  check (track_type in ('steel','wooden','hybrid'))
);

-- Clone entre parques continua legal (Nemesis em dois parques e' possivel),
-- duplicata dentro do mesmo parque nao.
create unique index coasters_nome_por_parque on public.coasters (park_id, lower(btrim(name)));
create index coasters_por_parque     on public.coasters (park_id);
create index coasters_por_fabricante on public.coasters (manufacturer_id);

-- ------------------------------------------------------------------- rides
create table public.rides (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  -- restrict, e nao cascade: apagar um coaster nao pode apagar o historico de ninguem
  coaster_id uuid        not null references public.coasters(id) on delete restrict,
  ridden_on  date        not null default current_date,
  note       text,
  created_at timestamptz not null default now(),

  constraint rides_data_nao_futura check (ridden_on <= current_date),
  -- o SOW diz "short note"; sem teto alguem cola um livro numa coluna publica de largura
  constraint rides_nota_tamanho    check (note is null or char_length(note) <= 280)
);

-- NAO existe unique em (user_id, coaster_id, ridden_on): FR3 exige que andar de
-- novo no mesmo dia seja legal.
create index rides_por_usuario on public.rides (user_id, ridden_on desc);
create index rides_credito     on public.rides (user_id, coaster_id);

-- --------------------------------------------------------- catalogue_audit
-- survivor_id e loser_id NAO sao chaves estrangeiras de proposito: o perdedor
-- deixa de existir na fusao, e a linha de auditoria precisa sobreviver a ele.
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
