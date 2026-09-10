-- 20260910000002_grants_hardening.sql
--
-- Conserta uma ordem errada e uma suposicao errada, achadas na revisao de seguranca.
--
-- Ordem errada: a migration 0002 roda `revoke all on all tables` e depois concede o
-- que cada papel precisa. As cinco views nasceram na 0004, DEPOIS disso, entao elas
-- receberam o default privilege do Supabase inteiro: anon e authenticated ficaram com
-- INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER e REFERENCES em cima delas.
--
-- Nao vaza hoje, porque `security_invoker` faz a view exigir permissao nas tabelas de
-- baixo, e la a RLS segura. Mas e' uma mina: no dia em que o catalogo for aberto para
-- visitante, as cinco passam a servir o agregado de todo mundo. Concessao larga que so
-- nao vaza por causa de outra camada nao e' desenho, e' sorte.
--
-- Suposicao errada: o TDD afirma que `handle_new_user` nao e' chamavel por cliente
-- nenhum "since EXECUTE is revoked". O `revoke ... from public` nao apaga a concessao
-- explicita que o default privilege do Supabase da para anon e authenticated, entao os
-- tres definers estavam com `anon=X` no proacl. O PostgREST realmente nao expoe funcao
-- que retorna `trigger`, entao nao era explorabilidade, mas o mecanismo descrito no
-- documento nao era o mecanismo real. Agora e'.

-- ----------------------------------------------------------------- views
do $$
declare v text;
begin
  foreach v in array array[
    'my_totals','my_credits_by_country','my_credits_by_manufacturer',
    'my_credits_by_type','my_most_ridden'
  ] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v);
    -- so o dono le a propria linha, e quem faz esse recorte e' a policy em rides
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- ------------------------------------------------------------- funcoes
-- Cada uma recebe exatamente quem precisa chamar, e ninguem mais.

revoke all on function public.leaderboard(integer, integer)      from public, anon, authenticated;
revoke all on function public.merge_coasters(uuid, uuid)         from public, anon, authenticated;
revoke all on function public.handle_new_user()                  from public, anon, authenticated;

-- o ranking e' publico por requisito (FR1, AC3)
grant execute on function public.leaderboard(integer, integer) to anon, authenticated;

-- fundir duplicata e' operacao de admin. O corpo re-checa o papel, porque um definer
-- ignora RLS; a concessao aqui e' a primeira porta, o re-check e' a segunda.
grant execute on function public.merge_coasters(uuid, uuid) to authenticated;

-- handle_new_user roda como trigger, disparada pelo Supabase Auth. Nenhum cliente
-- precisa poder chama-la, e agora nenhum pode.

-- ----------------------------------------------------- conferencia
do $$
declare erro text;
begin
  select string_agg(format('%s tem %s em %s', grantee, privilege_type, table_name), '; ')
    into erro
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name like 'my\_%'
    and grantee in ('anon','authenticated') and privilege_type <> 'SELECT';
  if erro is not null then
    raise exception 'view de estatistica com concessao alem de SELECT: %', erro;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))
  ) then
    raise exception 'handle_new_user continua chamavel por cliente';
  end if;

  raise notice 'concessoes conferidas: views so SELECT, handle_new_user fechada';
end $$;
