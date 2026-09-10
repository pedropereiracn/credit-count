-- 0004_views.sql  Credit Count: as cinco estatisticas do painel.
--
-- `security_invoker = true` quer dizer: a view roda com a identidade de QUEM CHAMA.
-- Por isso NENHUMA delas tem `where user_id = auth.uid()`. A regra esta' escrita uma
-- vez so', na politica de rides, e as cinco herdam. Duplicar o filtro aqui criaria
-- cinco lugares novos para errar.
--
-- O preco disso: se uma view perder a marca `security_invoker`, ela passa a servir o
-- agregado de TODO MUNDO, em silencio. E o invariante interno (creditos = soma dos
-- agrupamentos) continua batendo, porque ele mede consistencia, nao dono. Por isso o
-- passo 2 do portao le as cinco como um segundo usuario, e a auditoria da 0005 recusa
-- qualquer view sem a marca.

create view public.my_totals with (security_invoker = true) as
  select
    count(distinct r.coaster_id)::integer as credits,   -- FR4: a manchete
    count(*)::integer                     as rides      -- FR4: e o total de rides
  from public.rides r;

create view public.my_credits_by_country with (security_invoker = true) as
  select
    pk.country_code,
    count(distinct r.coaster_id)::integer as credits
  from public.rides r
  join public.coasters c on c.id = r.coaster_id
  join public.parks    pk on pk.id = c.park_id
  group by pk.country_code
  order by credits desc, pk.country_code;

create view public.my_credits_by_manufacturer with (security_invoker = true) as
  select
    -- coalesce, e nao filtro: coaster de fabricante desconhecido continua contando,
    -- senao a soma dos agrupamentos deixa de bater com o total.
    coalesce(m.name, 'Unknown') as manufacturer,
    count(distinct r.coaster_id)::integer as credits
  from public.rides r
  join public.coasters c on c.id = r.coaster_id
  left join public.manufacturers m on m.id = c.manufacturer_id
  group by coalesce(m.name, 'Unknown')
  order by credits desc, 1;

create view public.my_credits_by_type with (security_invoker = true) as
  select
    c.track_type,
    count(distinct r.coaster_id)::integer as credits
  from public.rides r
  join public.coasters c on c.id = r.coaster_id
  group by c.track_type
  order by credits desc, c.track_type;

create view public.my_most_ridden with (security_invoker = true) as
  select
    c.id as coaster_id,
    c.name,
    p.name as park_name,
    count(*)::integer  as rides,
    max(r.ridden_on)   as last_ridden
  from public.rides r
  join public.coasters c on c.id = r.coaster_id
  join public.parks    p on p.id = c.park_id
  group by c.id, c.name, p.name
  -- empate resolvido pela ride mais recente, para o numero nao dancar entre cargas
  order by rides desc, last_ridden desc
  limit 1;

-- Numa view invoker, o chamador tambem precisa de permissao nas tabelas de baixo.
-- `authenticated` tem. `anon` nao recebe nada aqui: painel e' area logada.
grant select on
  public.my_totals,
  public.my_credits_by_country,
  public.my_credits_by_manufacturer,
  public.my_credits_by_type,
  public.my_most_ridden
to authenticated;
