-- 20260910000002_grants_hardening.sql
--
-- Fixes one wrong ordering and one wrong assumption, found in the security review.
--
-- Wrong ordering: migration 0002 runs `revoke all on all tables` and then grants what
-- each role needs. The five views were born in 0004, AFTER that, so they
-- received Supabase's whole default privilege: anon and authenticated ended up with
-- INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES on them.
--
-- It does not leak today, because `security_invoker` makes the view require permission on
-- the underlying tables, and RLS holds there. But it is a landmine: the day the catalogue is
-- opened to visitors, the five start serving everyone's aggregate. A broad grant that only
-- does not leak because of another layer is not design, it is luck.
--
-- Wrong assumption: the TDD claims `handle_new_user` is not callable by any
-- client "since EXECUTE is revoked". `revoke ... from public` does not erase the explicit
-- grant that Supabase's default privilege gives to anon and authenticated, so the
-- three definers had `anon=X` in the proacl. PostgREST really does not expose a function
-- that returns `trigger`, so it was not exploitability, but the mechanism described in the
-- document was not the real mechanism. Now it is.

-- ----------------------------------------------------------------- views
do $$
declare v text;
begin
  foreach v in array array[
    'my_totals','my_credits_by_country','my_credits_by_manufacturer',
    'my_credits_by_type','my_most_ridden'
  ] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v);
    -- only the owner reads their own row, and the policy on rides is what makes that cut
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- ----------------------------------------------------------- functions
-- Each one receives exactly who needs to call it, and no one else.

revoke all on function public.leaderboard(integer, integer)      from public, anon, authenticated;
revoke all on function public.merge_coasters(uuid, uuid)         from public, anon, authenticated;
revoke all on function public.handle_new_user()                  from public, anon, authenticated;

-- the ranking is public by requirement (FR1, AC3)
grant execute on function public.leaderboard(integer, integer) to anon, authenticated;

-- merging a duplicate is an admin operation. The body re-checks the role, because a definer
-- ignores RLS; the grant here is the first door, the re-check is the second.
grant execute on function public.merge_coasters(uuid, uuid) to authenticated;

-- handle_new_user runs as a trigger, fired by Supabase Auth. No client
-- needs to be able to call it, and now none can.

-- ---------------------------------------------------------- checks
do $$
declare erro text;
begin
  select string_agg(format('%s tem %s em %s', grantee, privilege_type, table_name), '; ')
    into erro
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name like 'my\_%'
    and grantee in ('anon','authenticated') and privilege_type <> 'SELECT';
  if erro is not null then
    raise exception 'statistic view granted beyond SELECT: %', erro;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))
  ) then
    raise exception 'handle_new_user continua chamavel por cliente';
  end if;

  raise notice 'grants verified: views SELECT-only, handle_new_user closed';
end $$;
