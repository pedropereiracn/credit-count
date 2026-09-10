-- 0002_security.sql  Credit Count: RLS, concessoes e politicas.
--
-- ESTE E' O ARQUIVO. Se uma linha aqui estiver sutilmente errada, nao e' um bug,
-- e' dado privado de outra pessoa saindo pela API. Le linha por linha.
--
-- Ordem mental correta, e o Postgres avalia nesta ordem:
--   1. a CONCESSAO (grant) decide se o papel alcanca a tabela e a COLUNA
--   2. a POLITICA (policy) decide quais LINHAS, por comando
-- Concessao vem antes. Um PATCH em coluna sem concessao morre antes da RLS existir.

-- ---------------------------------------------------------------------------
-- 1. RLS ligada em tudo, antes de qualquer politica.
--    Tabela com RLS ligada e zero politica e' tabela inalcancavel. O padrao e' negar.
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.parks           enable row level security;
alter table public.manufacturers   enable row level security;
alter table public.coasters        enable row level security;
alter table public.rides           enable row level security;
alter table public.catalogue_audit enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Zera o que o Supabase concede por padrao, e concede de novo a mao.
--    Sem este revoke, o desenho abaixo esta' apenas por cima de um padrao permissivo.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. is_admin(): SECURITY INVOKER, entao le a propria linha sob RLS.
--    Nao pode ser usada em politica de profiles: seria recursao infinita.
--    Ela so aparece nas politicas de catalogo, e no corpo de merge_coasters.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. profiles
--    Concessao por COLUNA. `role` esta' fora do update: e' isto, e nao a politica,
--    que faz um PATCH {"role":"admin"} falhar. E nao existe insert nem delete
--    para cliente nenhum, entao a linha so nasce pelo trigger da 0003.
-- ---------------------------------------------------------------------------
grant select (id, display_name, role, show_on_leaderboard, created_at)
  on public.profiles to authenticated;
grant update (display_name, show_on_leaderboard)
  on public.profiles to authenticated;
-- anon nao recebe nada em profiles (FR1: visitante nao ve dado de usuario)

create policy profiles_le_propria on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_atualiza_propria on public.profiles
  for update to authenticated
  using       (id = (select auth.uid()))
  with check  (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. rides: uma politica por comando, todas presas a auth.uid().
--    NAO existe ramo de admin aqui, e a ausencia e' o requisito (SOW 3).
--    `using` filtra o que ja' esta' la'; `with check` valida o que esta' entrando.
--    UPDATE precisa dos dois: sem o with check, da' para mover a ride para outro dono.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.rides to authenticated;

create policy rides_le_proprias on public.rides
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy rides_insere_proprias on public.rides
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy rides_atualiza_proprias on public.rides
  for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy rides_apaga_proprias on public.rides
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Catalogo: TRES tabelas, e a regra e' a mesma nas tres.
--    Renomear um fabricante move a estatistica de todo mundo ao mesmo tempo,
--    entao e' o mesmo privilegio que editar um coaster (FR8, AC4).
--    anon nao recebe nada: visitante deslogado nao le catalogo (FR1).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.coasters, public.parks, public.manufacturers to authenticated;

-- coasters
create policy coasters_leitura on public.coasters
  for select to authenticated using (true);
create policy coasters_insere_admin on public.coasters
  for insert to authenticated with check (public.is_admin());
create policy coasters_atualiza_admin on public.coasters
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coasters_apaga_admin on public.coasters
  for delete to authenticated using (public.is_admin());

-- parks
create policy parks_leitura on public.parks
  for select to authenticated using (true);
create policy parks_insere_admin on public.parks
  for insert to authenticated with check (public.is_admin());
create policy parks_atualiza_admin on public.parks
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy parks_apaga_admin on public.parks
  for delete to authenticated using (public.is_admin());

-- manufacturers
create policy manufacturers_leitura on public.manufacturers
  for select to authenticated using (true);
create policy manufacturers_insere_admin on public.manufacturers
  for insert to authenticated with check (public.is_admin());
create policy manufacturers_atualiza_admin on public.manufacturers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy manufacturers_apaga_admin on public.manufacturers
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. catalogue_audit: NENHUMA concessao e NENHUMA politica, de proposito.
--    RLS ligada mais zero politica quer dizer inalcancavel pela API. Escrita pela
--    funcao elevada da 0003, lida so em SQL. O silencio aqui e' a decisao.
-- ---------------------------------------------------------------------------
