-- 0003_functions.sql  Credit Count: as tres funcoes elevadas, e nada mais.
--
-- SECURITY DEFINER = roda com o privilegio de quem CRIOU a funcao, nao de quem chama.
-- Ou seja, ela ignora RLS. Por isso as tres regras abaixo valem para as tres:
--   1. `set search_path = ''` e todo nome qualificado com o esquema. Sem isso, alguem
--      poe uma tabela `profiles` num esquema proprio e a funcao passa a ler a falsa.
--   2. o corpo re-checa quem esta' chamando, porque a RLS nao vai checar por ele.
--   3. `revoke all ... from public` ANTES do grant. Funcao nova ja' nasce executavel
--      por `public`, e revogar so de anon e authenticated e' o erro classico.
--
-- Se um dia existir uma quarta funcao definer, a auditoria da 0005 quebra o build.

-- ---------------------------------------------------------------------------
-- 1. leaderboard()
--    O TIPO DE RETORNO E' A TRAVA. Tres colunas, e nenhuma delas consegue carregar
--    qual coaster alguem andou (FR7). Nao existe parametro de pessoa, entao
--    "me da' o historico do fulano" nao tem assinatura onde ser escrito.
-- ---------------------------------------------------------------------------
create function public.leaderboard(page_size integer default 50, page_offset integer default 0)
returns table (rank integer, display_name text, credits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- rank() calculada DENTRO do conjunto ja' filtrado por show_on_leaderboard.
    -- Se fosse calculada antes do filtro, buraco na numeracao (1, 2, 4) denunciaria
    -- que existe alguem escondido na posicao 3.
    rank() over (order by q.credits desc)::integer,
    q.display_name,
    q.credits
  from (
    select
      p.id,
      p.display_name,
      count(distinct r.coaster_id)::integer as credits
    from public.profiles p
    -- LEFT JOIN, e nao inner: FR7 diz "para usuarios que optaram", sem exigir
    -- que ja' tenham andado em algo. Quem optou e tem zero aparece com zero.
    left join public.rides r on r.user_id = p.id
    where p.show_on_leaderboard
    group by p.id, p.display_name
  ) q
  -- desempate por nome e depois por id, para a paginacao nao repetir nem pular linha
  order by q.credits desc, q.display_name, q.id
  -- o chamador pede o tamanho da pagina, a funcao poe o teto. Ninguem arranca
  -- a tabela inteira de um banco free tier num pedido so.
  limit  least(greatest(coalesce(page_size, 50), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

revoke all on function public.leaderboard(integer, integer) from public;
grant execute on function public.leaderboard(integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. handle_new_user()
--    Escreve a linha de profiles que cliente nenhum tem permissao de inserir.
--    `role` e' literal: metadado do formulario nao chega perto dele.
--    Chamavel por ninguem: PostgREST nao expoe funcao que retorna `trigger`,
--    e o execute esta' revogado de `public`, que e' a barreira que sobra.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome text;
begin
  -- ordem de tentativa. Cada passo existe por um motivo:
  nome := btrim(coalesce(new.raw_user_meta_data->>'display_name', ''));

  -- cadastro sem nome (e' o caso de OAuth, se um dia entrar)
  if nome = '' then
    nome := btrim(coalesce(new.raw_user_meta_data->>'full_name', ''));
  end if;
  if nome = '' then
    nome := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  -- corta ANTES de aparar, nunca o contrario: cortar em 40 pode deixar espaco no fim,
  -- e a restricao profiles_nome_aparado recusaria a linha.
  nome := btrim(left(nome, 40));

  -- Rede de seguranca. Sem ela, um nome de 1 caractere estoura a restricao DENTRO
  -- do trigger, e estourar aqui nao devolve erro bonito: derruba o cadastro inteiro.
  -- O AC1 comeca com "a new user can sign up", entao isto nao pode falhar nunca.
  if char_length(nome) < 2 then
    nome := 'rider_' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, display_name, role, show_on_leaderboard)
  values (new.id, nome, 'enthusiast', false);
  --                     ^^^^^^^^^^^^ literal. E' esta palavra que faz o passo 1
  --                     do portao de verificacao voltar sempre como enthusiast.

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. merge_coasters()
--    Definer ignora RLS, entao o corpo re-checa admin na primeira linha.
--    Devolve UM inteiro, quantas rides se moveram: agregado sobre o catalogo,
--    nunca um nome de pessoa.
-- ---------------------------------------------------------------------------
create function public.merge_coasters(survivor uuid, loser uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  movidas       integer;
  nome_perdedor text;
begin
  -- is_admin() e' invoker, mas chamada aqui dentro ela roda como o definer.
  -- Isso NAO quebra a checagem: auth.uid() vem do JWT da requisicao e nao muda,
  -- entao ela continua respondendo sobre quem esta' chamando de verdade.
  if not public.is_admin() then
    raise exception 'apenas admin pode fundir catalogo' using errcode = '42501';
  end if;

  if survivor = loser then
    raise exception 'survivor e loser sao o mesmo coaster' using errcode = '22023';
  end if;

  select c.name into nome_perdedor from public.coasters c where c.id = loser;
  if nome_perdedor is null then
    raise exception 'coaster perdedor nao existe' using errcode = '23503';
  end if;
  if not exists (select 1 from public.coasters where id = survivor) then
    raise exception 'coaster sobrevivente nao existe' using errcode = '23503';
  end if;

  -- Quem andou nos DOIS passa a ter duas rides no mesmo coaster, e o credito dele
  -- cai de dois para um. Isso esta' CORRETO: a duplicata nunca foi dois creditos.
  -- E' tambem o unico caminho pelo qual um admin altera o total de outra pessoa,
  -- e por isso a linha de auditoria abaixo nao e' enfeite.
  update public.rides set coaster_id = survivor where coaster_id = loser;
  get diagnostics movidas = row_count;

  delete from public.coasters where id = loser;

  insert into public.catalogue_audit
    (action, actor_id, survivor_id, loser_id, loser_name, rides_moved)
  values
    ('merge', (select auth.uid()), survivor, loser, nome_perdedor, movidas);

  return movidas;
end;
$$;

revoke all on function public.merge_coasters(uuid, uuid) from public;
grant execute on function public.merge_coasters(uuid, uuid) to authenticated;
