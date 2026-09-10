-- 0004_views.sql  Credit Count: the five dashboard statistics.
--
-- `security_invoker = true` means: the view runs with the identity of THE CALLER.
-- That is why NONE of them has `where user_id = auth.uid()`. The rule is written
-- once, in the rides policy, and the five inherit it. Duplicating the filter here would
-- create five new places to get it wrong.
--
-- The price of that: if a view loses the `security_invoker` flag, it starts serving
-- EVERYONE's aggregate, silently. And the internal invariant (credits = sum of the
-- groupings) still holds, because it measures consistency, not ownership. That is why
-- step 2 of the gate reads the five as a second user, and the 0005 audit rejects
-- any view without the flag.

create view public.my_totals with (security_invoker = true) as
  select
    count(distinct r.coaster_id)::integer as credits,   -- FR4: the headline
    count(*)::integer                     as rides      -- FR4: and the total ride count
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
    -- coalesce, not a filter: a coaster with an unknown manufacturer still counts,
    -- otherwise the sum of the groupings stops matching the total.
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
  -- ties resolved by the most recent ride, so the number does not dance between loads
  order by rides desc, last_ridden desc
  limit 1;

-- In an invoker view, the caller also needs permission on the underlying tables.
-- `authenticated` has it. `anon` receives nothing here: the dashboard is a logged-in area.
grant select on
  public.my_totals,
  public.my_credits_by_country,
  public.my_credits_by_manufacturer,
  public.my_credits_by_type,
  public.my_most_ridden
to authenticated;
