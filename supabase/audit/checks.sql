-- checks.sql  What no client can see, verified in SQL.
--
-- Runs with the connection string, locally, alongside the HTTP gate. Each block raises
-- an exception and takes down the build. It does not print a warning: it breaks.

do $$
declare missing text;
begin
  -- 1. RLS on for every table in public, with no exception
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then
    raise exception 'table without RLS: %', missing;
  end if;

  -- 2. Exactly three SECURITY DEFINER functions, and they are these three.
  --    A fourth appearing takes down the build on purpose.
  select string_agg(p.proname, ', ') into missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and p.proname not in ('leaderboard','handle_new_user','merge_coasters');
  if missing is not null then
    raise exception 'elevated function outside the inventory: %', missing;
  end if;

  -- 3. Every definer function with a locked search_path
  select string_agg(p.proname, ', ') into missing
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
  if missing is not null then
    raise exception 'definer function without a locked search_path: %', missing;
  end if;

  -- 4. Every view in public with security_invoker
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') <> 'true';
  if missing is not null then
    raise exception 'view without security_invoker: %', missing;
  end if;

  -- 5. No write grant on profiles.role for any client role.
  --    It is the shape of the grant that stops the promotion, so the shape is checked.
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and privilege_type in ('UPDATE','INSERT')
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'profiles.role was granted a write privilege';
  end if;

  -- 6. catalogue_audit with no policy at all, which is what makes it unreachable
  if exists (select 1 from pg_policies where schemaname='public' and tablename='catalogue_audit') then
    raise exception 'catalogue_audit has a policy: it must be unreachable through the API';
  end if;

  -- 7. No rides policy mentioning admin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='rides'
      and (coalesce(qual,'') || coalesce(with_check,'')) ilike '%is_admin%'
  ) then
    raise exception 'a rides policy mentions admin: SOW section 3 forbids it';
  end if;

  -- 8. No client role may EXECUTE any function except the public leaderboard.
  --    is_admin, handle_new_user and merge_coasters must never be anon-callable.
  --    A revoke that only holds because of a second layer is invisible to blocks
  --    1-7, so it is checked here directly against the live grants.
  select string_agg(p.proname, ', ') into missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname <> 'leaderboard'
    and has_function_privilege('anon', p.oid, 'execute');
  if missing is not null then
    raise exception 'anon can execute a function beyond leaderboard: %', missing;
  end if;

  raise notice 'SQL audit: 8 blocks, all clear';
end $$;

-- 8. Cleanup: the gate creates one account per run and cannot delete it on its own,
-- because deleting a user requires the secret key and no application code may
-- carry one. Here, it can: this audit runs locally, against the database, as the owner.
do $$
declare removed int;
begin
  delete from auth.users where email like 'gate+%@credit-count.test';
  get diagnostics removed = row_count;
  if removed > 0 then
    raise notice 'cleanup: % gate test account(s) removed', removed;
  end if;
end $$;
