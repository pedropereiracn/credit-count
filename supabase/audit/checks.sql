-- 0005_auditoria.sql  O que nenhum cliente consegue ver, conferido em SQL.
--
-- Roda com a connection string, local, junto do portao HTTP. Cada bloco levanta
-- excecao e derruba o build. Nao imprime aviso: quebra.

do $$
declare faltando text;
begin
  -- 1. RLS ligada em toda tabela de public, sem excecao
  select string_agg(c.relname, ', ') into faltando
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if faltando is not null then
    raise exception 'tabela sem RLS: %', faltando;
  end if;

  -- 2. Exatamente tres funcoes SECURITY DEFINER, e sao estas tres.
  --    Uma quarta aparecendo derruba o build de proposito.
  select string_agg(p.proname, ', ') into faltando
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and p.proname not in ('leaderboard','handle_new_user','merge_coasters');
  if faltando is not null then
    raise exception 'funcao elevada fora do inventario: %', faltando;
  end if;

  -- 3. Toda funcao definer com search_path travado
  select string_agg(p.proname, ', ') into faltando
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    -- Postgres renderiza o search_path vazio como search_path="" (com aspas), nao
    -- como search_path=. A comparacao literal anterior acusava as tres funcoes
    -- corretas, todas as vezes. Aqui a verificacao normaliza antes de comparar.
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
      where btrim(split_part(cfg, '=', 1)) = 'search_path'
        and btrim(substr(cfg, strpos(cfg, '=') + 1), '"''') = ''
    );
  if faltando is not null then
    raise exception 'funcao definer sem search_path travado: %', faltando;
  end if;

  -- 4. Toda view de public com security_invoker
  select string_agg(c.relname, ', ') into faltando
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') <> 'true';
  if faltando is not null then
    raise exception 'view sem security_invoker: %', faltando;
  end if;

  -- 5. Nenhuma concessao de escrita em profiles.role para papel de cliente.
  --    E' a forma do grant que segura a promocao, entao a forma e' conferida.
  if exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and privilege_type in ('UPDATE','INSERT')
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'profiles.role recebeu concessao de escrita';
  end if;

  -- 6. catalogue_audit sem politica nenhuma, que e' o que a torna inalcancavel
  if exists (select 1 from pg_policies where schemaname='public' and tablename='catalogue_audit') then
    raise exception 'catalogue_audit ganhou politica: ela deveria ser inalcancavel pela API';
  end if;

  -- 7. Nenhuma politica de rides mencionando admin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='rides'
      and (coalesce(qual,'') || coalesce(with_check,'')) ilike '%is_admin%'
  ) then
    raise exception 'politica de rides com ramo de admin: o SOW 3 proibe';
  end if;

  raise notice 'auditoria SQL: 7 blocos, tudo certo';
end $$;

-- 8. Limpeza: o portao cria uma conta por execucao e nao consegue apagar sozinho,
-- porque apagar usuario exige a chave secreta e nenhum codigo de aplicacao pode
-- carregar uma. Aqui, sim: esta auditoria roda localmente, contra o banco, como dono.
do $$
declare removidas int;
begin
  delete from auth.users where email like 'gate+%@credit-count.test';
  get diagnostics removidas = row_count;
  if removidas > 0 then
    raise notice 'limpeza: % conta(s) de teste do portao removida(s)', removidas;
  end if;
end $$;
