-- 0005_auditoria.sql  What no client can see, verified in SQL.
--
-- Runs with the connection string, locally, alongside the HTTP gate. Each block raises
-- an exception and takes down the build. It does not print a warning: it breaks.

do $$
declare faltando text;
begin
  -- 1. RLS on for every table in public, with no exception
  select string_agg(c.relname, ', ') into faltando
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if faltando is not null then
    raise exception 'table without RLS: %', faltando;
  end if;

  -- 2. Exactly three SECURITY DEFINER functions, and they are these three.
  --    A fourth appearing takes down the build on purpose.
  select string_agg(p.proname, ', ') into faltando
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and p.proname not in ('leaderboard','handle_new_user','merge_coasters');
  if faltando is not null then
    raise exception 'elevated function outside the inventory: %', faltando;
  end if;

  -- 3. Every definer function with a locked search_path
  select string_agg(p.proname, ', ') into faltando
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    -- Postgres renders the empty search_path as search_path="" (with quotes), not
    -- as search_path=. The previous literal comparison flagged the three correct
    -- functions, every time. Here the check normalises before comparing.
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
      where btrim(split_part(cfg, '=', 1)) = 'search_path'
        and btrim(substr(cfg, strpos(cfg, '=') + 1), '"''') = ''
    );
  if faltando is not null then
    raise exception 'definer function without a locked search_path: %', faltando;
  end if;

  -- 4. Every view in public with security_invoker
  select string_agg(c.relname, ', ') into faltando
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') <> 'true';
  if faltando is not null then
    raise exception 'view without security_invoker: %', faltando;
  end if;

  -- 5. No write grant on profiles.role for any client role.
  --    It is the shape of the grant that stops the promotion, so the shape is checked.
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and privilege_type in ('UPDATE','INSERT')
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'profiles.role recebeu concessao de escrita';
  end if;

  -- 6. catalogue_audit with no policy at all, which is what makes it unreachable
  if exists (select 1 from pg_policies where schemaname='public' and tablename='catalogue_audit') then
    raise exception 'catalogue_audit ganhou politica: ela deveria ser inalcancavel pela API';
  end if;

  -- 7. No rides policy mentioning admin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='rides'
      and (coalesce(qual,'') || coalesce(with_check,'')) ilike '%is_admin%'
  ) then
    raise exception 'politica de rides com ramo de admin: o SOW 3 proibe';
  end if;

  raise notice 'SQL audit: 7 blocks, all clear';
end $$;

-- 8. Cleanup: the gate creates one account per run and cannot delete it on its own,
-- because deleting a user requires the secret key and no application code may
-- carry one. Here, it can: this audit runs locally, against the database, as the owner.
do $$
declare removidas int;
begin
  delete from auth.users where email like 'gate+%@credit-count.test';
  get diagnostics removidas = row_count;
  if removidas > 0 then
    raise notice 'cleanup: % gate test account(s) removed', removidas;
  end if;
end $$;
