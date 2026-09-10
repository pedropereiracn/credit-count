-- 0002_security.sql  Credit Count: RLS, grants and policies.
--
-- THIS IS THE FILE. If a line here is subtly wrong, it is not a bug,
-- it is someone else's private data leaving through the API. Read it line by line.
--
-- The correct mental order, and the order Postgres evaluates in:
--   1. the GRANT decides whether the role reaches the table and the COLUMN
--   2. the POLICY decides which ROWS, per command
-- The grant comes first. A PATCH on a column with no grant dies before RLS exists.

-- ---------------------------------------------------------------------------
-- 1. RLS on everywhere, before any policy.
--    A table with RLS on and zero policies is an unreachable table. The default is deny.
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.parks           enable row level security;
alter table public.manufacturers   enable row level security;
alter table public.coasters        enable row level security;
alter table public.rides           enable row level security;
alter table public.catalogue_audit enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Reset what Supabase grants by default, and grant it again by hand.
--    Without this revoke, the design below only sits on top of a permissive default.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. is_admin(): SECURITY INVOKER, so it reads its own row under RLS.
--    It cannot be used in a profiles policy: that would be infinite recursion.
--    It only appears in the catalogue policies, and in the body of merge_coasters.
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
--    Grant by COLUMN. `role` is left out of the update: it is this, not the policy,
--    that makes a PATCH {"role":"admin"} fail. And there is no insert or delete
--    for any client, so the row is only born through the 0003 trigger.
-- ---------------------------------------------------------------------------
grant select (id, display_name, role, show_on_leaderboard, created_at)
  on public.profiles to authenticated;
grant update (display_name, show_on_leaderboard)
  on public.profiles to authenticated;
-- anon receives nothing on profiles (FR1: a visitor sees no user data)

create policy profiles_le_propria on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_atualiza_propria on public.profiles
  for update to authenticated
  using       (id = (select auth.uid()))
  with check  (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. rides: one policy per command, all tied to auth.uid().
--    There is NO admin branch here, and that absence is the requirement (SOW 3).
--    `using` filters what is already there; `with check` validates what is coming in.
--    UPDATE needs both: without the with check, a ride can be moved to another owner.
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
-- 6. Catalogue: THREE tables, and the rule is the same across all three.
--    Renaming a manufacturer moves everyone's statistic at the same time,
--    so it is the same privilege as editing a coaster (FR8, AC4).
--    anon receives nothing: a logged-out visitor does not read the catalogue (FR1).
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
-- 7. catalogue_audit: NO grant and NO policy, on purpose.
--    RLS on plus zero policies means unreachable through the API. Written by the
--    elevated function in 0003, read only in SQL. The silence here is the decision.
-- ---------------------------------------------------------------------------
